/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillUnmount, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { browser } from "@web/core/browser/browser";
const { DateTime } = luxon;

/**
 * KitchenOrderCard Component
 * Represents a single order card with timer logic.
 */
class KitchenOrderCard extends Component {
    static template = "pos_kitchen_screen.KitchenOrderCard";
    static props = {
        order: Object,
        slaWarning: Number,
        slaCritical: Number,
    };

    setup() {
        this.state = useState({
            durationText: "00:00",
            statusRequest: 'normal',
        });

        this.updateTimer = this.updateTimer.bind(this);

        onMounted(() => {
            this.updateTimer();
            this.interval = setInterval(this.updateTimer, 1000);
        });

        onWillUnmount(() => {
            if (this.interval) clearInterval(this.interval);
        });
    }

    updateTimer() {
        const now = DateTime.now();
        let orderDate = DateTime.fromISO(this.props.order.date_order);
        if (!orderDate.isValid) {
            orderDate = DateTime.fromSQL(this.props.order.date_order);
        }

        const diff = now.diff(orderDate, ['minutes', 'seconds']);
        const minutes = Math.floor(diff.minutes);
        const seconds = Math.floor(diff.seconds);

        this.state.durationText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        if (minutes >= this.props.slaCritical) {
            this.state.statusRequest = 'critical';
        } else if (minutes >= this.props.slaWarning) {
            this.state.statusRequest = 'warning';
        } else {
            this.state.statusRequest = 'normal';
        }
    }
}

/**
 * KitchenMainComponent
 * Root component for the Kitchen Screen Application.
 */
class KitchenMainComponent extends Component {
    static template = "pos_kitchen_screen.KitchenMain";
    static components = { KitchenOrderCard };

    setup() {
        this.orm = useService("orm");
        this.bus = useService("bus_service");
        this.notification = useService("notification");

        this.state = useState({
            orders: [],
            availableDisplays: [], // List of pos.kitchen.display
            selectedDisplayId: null, // ID of currently selected display
            currentDisplayConfig: null, // Full object of selected display
            filterProduct: null,
            audioEnabled: false,
        });

        // Global Config (SLA)
        this.config = {
            slaWarning: 15,
            slaCritical: 30,
            enableSound: true
        };

        // Load Config and Initial State
        onWillStart(async () => {
            await this.loadGlobalConfig();

            // multiple screens support
            const savedDisplayId = browser.localStorage.getItem('pos_kitchen_display_id');
            if (savedDisplayId) {
                await this.selectDisplay(parseInt(savedDisplayId));
            } else {
                await this.loadAvailableDisplays();
            }
        });

        useEffect(() => {
            const channel = "kitchen_new_order";
            const listener = (payload) => this.onNewOrder(payload);
            this.bus.subscribe("kitchen_new_order", listener);
            this.bus.addChannel("kitchen_new_order");
            return () => {
                this.bus.unsubscribe("kitchen_new_order", listener);
            };
        });
    }

    // --- Data Loading ---

    async loadGlobalConfig() {
        try {
            const configs = await this.orm.searchRead("pos.config", [], ["kitchen_sla_warning", "kitchen_sla_critical", "enable_sound_notifications"], { limit: 1 });
            if (configs && configs.length) {
                this.config.slaWarning = configs[0].kitchen_sla_warning;
                this.config.slaCritical = configs[0].kitchen_sla_critical;
                this.config.enableSound = configs[0].enable_sound_notifications;
            }
        } catch (e) {
            console.error("Error loading global config:", e);
        }
    }

    async loadAvailableDisplays() {
        try {
            const displays = await this.orm.searchRead("pos.kitchen.display", [], ["name"], { order: "name asc" });
            this.state.availableDisplays = displays;
        } catch (e) {
            console.error("Error loading displays:", e);
            this.notification.add("Could not load display list.", { type: "danger" });
        }
    }

    async selectDisplay(displayId) {
        try {
            // Fetch configuration including new SLA settings
            const displayConfig = await this.orm.searchRead(
                "pos.kitchen.display",
                [["id", "=", displayId]],
                ["name", "pos_config_ids", "pos_category_ids", "kitchen_sla_warning", "kitchen_sla_critical", "enable_sound_notifications"],
                { limit: 1 }
            );

            if (displayConfig && displayConfig.length) {
                const conf = displayConfig[0];
                this.state.selectedDisplayId = displayId;
                this.state.currentDisplayConfig = conf;

                // Override Global Config with Local Display Config
                this.config.slaWarning = conf.kitchen_sla_warning || this.config.slaWarning;
                this.config.slaCritical = conf.kitchen_sla_critical || this.config.slaCritical;
                this.config.enableSound = conf.enable_sound_notifications;

                browser.localStorage.setItem('pos_kitchen_display_id', displayId);

                // Clear order list and reload
                this.state.orders = [];
                await this.loadOrders();
            } else {
                // Invalid ID or deleted, revert to selection
                browser.localStorage.removeItem('pos_kitchen_display_id');
                this.state.selectedDisplayId = null;
                await this.loadAvailableDisplays();
            }
        } catch (e) {
            console.error("Error selecting display:", e);
            this.state.selectedDisplayId = null;
        }
    }

    closeScreen() {
        // Return to Backend Dashboard
        // In Odoo, this usually means going back in history or reloading the page without the specific action
        window.history.back();
    }

    async forgetDisplay() {
        browser.localStorage.removeItem('pos_kitchen_display_id');
        this.state.selectedDisplayId = null;
        this.state.currentDisplayConfig = null;
        this.state.orders = [];
        await this.loadAvailableDisplays();
    }

    async loadOrders() {
        if (!this.state.selectedDisplayId) return;

        try {
            const domain = [['state', 'in', ['paid', 'done', 'invoiced']]];

            // Filter by POS Config Source
            const allowedConfigIds = this.state.currentDisplayConfig.pos_config_ids;
            if (allowedConfigIds && allowedConfigIds.length > 0) {
                domain.push(['config_id', 'in', allowedConfigIds]);
            }

            const orders = await this.orm.searchRead("pos.order", domain, ["name", "pos_reference", "date_order", "lines"], { limit: 20, order: "date_order desc" });

            // Collect all line IDs
            const lineIds = orders.flatMap(o => o.lines);
            if (lineIds.length) {
                // We need 'product_id' (to check category) and 'qty'
                // NOTE: To filter by category strictly, we need product.pos_categ_id. 
                // searchRead on pos.order.line gives product_id as (id, name).
                // We will fetch product info separately or rely on checking product_id if we have a way.
                // Standard approach: Fetch lines, then Fetch Product Info for those lines.

                const lines = await this.orm.searchRead("pos.order.line", [["id", "in", lineIds]], ["product_id", "qty", "order_id"]);

                // Extract unique product IDs to fetch categories
                // Extract unique product IDs to fetch categories
                const productIds = [...new Set(lines.map(l => l.product_id[0]))];
                let productsMap = {};
                if (productIds.length) {
                    // Step 1: Fetch product_tmpl_id from product.product
                    // Because 'pos_categ_id' might not be available on 'product.product' in this version.
                    // Only include order if it has lines relevant to this display
                    if (expandedLines.length > 0) {
                        processedOrders.push({
                            id: order.id,
                            name: order.pos_reference || order.name,
                            table: '', // Removed table to avoid error
                            date_order: order.date_order,
                            lines: expandedLines
                        });
                    }
                }

                this.state.orders = processedOrders;

            } else {
                this.state.orders = [];
            }

        } catch (e) {
            console.error("Error loading orders:", e);
            this.notification.add("Failed to load orders", { type: "danger" });
        }
    }

    onNewOrder(payload) {
        if (this.state.selectedDisplayId) {
            this.loadOrders();
            this.playSound();
            this.notification.add(`New Order: ${payload.name || ''}`, { type: "success" });
        }
    }

    playSound() {
        if (!this.config.enableSound) return;
        if (window.speechSynthesis) {
            const msg = new SpeechSynthesisUtterance("New Order");
            window.speechSynthesis.speak(msg);
        }
    }

    // --- Computed / Getters ---

    get aggregatedProducts() {
        const counts = {};
        for (const order of this.state.orders) {
            for (const line of order.lines) {
                if (!line.product_id) continue;
                const pName = line.product_id[1];
                const pId = line.product_id[0];
                if (!counts[pId]) {
                    counts[pId] = { id: pId, name: pName, qty: 0 };
                }
                counts[pId].qty += line.qty;
            }
        }
        return Object.values(counts).sort((a, b) => a.name.localeCompare(b.name));
    }

    get filteredOrders() {
        if (!this.state.filterProduct) return this.state.orders;
        return this.state.orders.filter(order =>
            order.lines.some(line => line.product_id && line.product_id[0] === this.state.filterProduct)
        );
    }

    // --- Actions ---

    toggleFilter(productId) {
        this.state.filterProduct = (this.state.filterProduct === productId) ? null : productId;
    }

    toggleAudio() {
        this.state.audioEnabled = !this.state.audioEnabled;
        if (this.state.audioEnabled) this.playSound();
    }
}

registry.category("actions").add("pos_kitchen_screen.main_view", KitchenMainComponent);
