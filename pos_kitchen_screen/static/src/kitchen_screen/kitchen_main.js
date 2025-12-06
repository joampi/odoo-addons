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
        onClickLine: Function,
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
        // DATE FIX: Parse Odoo UTC string as UTC
        let orderDate = DateTime.fromSQL(this.props.order.date_order, { zone: 'utc' });
        if (!orderDate.isValid) {
            orderDate = DateTime.fromISO(this.props.order.date_order, { zone: 'utc' });
        }
        orderDate = orderDate.toLocal(); // Convert to browser local time


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
            stages: [], // Loaded from backend
            availableDisplays: [], // List of pos.kitchen.display
            selectedDisplayId: null, // ID of currently selected display
            currentDisplayConfig: null, // Full object of selected display
            filterProduct: null,
            filterStage: null, // ID of stage to filter by
            sidebarCollapsed: false,
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
            await this.loadStages();

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

    // --- Interaction Logic ---

    async clickLine(order, line) {
        // Find current stage
        const currentStageId = line.kitchen_stage_id ? line.kitchen_stage_id[0] : null;
        const stageList = this.state.stages;

        // Find index
        let currentIndex = -1;
        if (currentStageId) {
            currentIndex = stageList.findIndex(s => s.id === currentStageId);
        }

        // Advance
        let nextStage = null;
        if (currentIndex < stageList.length - 1) {
            nextStage = stageList[currentIndex + 1];
        }

        if (nextStage) {
            // Optimistic Update
            line.kitchen_stage_id = [nextStage.id, nextStage.name];

            // Backend Update
            try {
                await this.orm.write("pos.order.line", [line.id], { kitchen_stage_id: nextStage.id });
                this.checkOrderCompletion(order);
            } catch (e) {
                console.error("Failed to update line stage", e);
                // Revert? (Complex, skipping for now)
            }
        }
    }

    async checkOrderCompletion(order) {
        // Logic: All lines must be in a 'done' stage or match the NEXT order stage to advance order?
        // User Rule: "change stage when all lines are tachadas" (crossed out)
        // Implementation: We track Order Stage vs Line Stage.

        // Simple approach first:
        // If ALL lines are 'Done' (last stage), mark Order as Done.
        // If ALL lines are 'Ready' (or higher), mark Order as Ready.

        const lines = order.lines;
        if (!lines.length) return;

        // Find the lowest stage among all lines
        // We use sequence to compare
        let minStageSequence = 999999;
        let minStageId = null;

        for (const line of lines) {
            const lStageId = line.kitchen_stage_id ? line.kitchen_stage_id[0] : 0;
            const stageObj = this.state.stages.find(s => s.id === lStageId) || this.state.stages[0]; // Default to first stage

            if (stageObj && stageObj.sequence < minStageSequence) {
                minStageSequence = stageObj.sequence;
                minStageId = stageObj.id;
            }
        }

        // The Order Status should be the "lowest common denominator" of its lines
        // e.g. If Line A is Prep, Line B is New -> Order is New.
        // If Line A is Prep, Line B is Prep -> Order is Prep.

        // However, we also have 'kitchen_state' on order which is a selection.
        // Let's assume we map Stage Names to Selection or just use the Stage logic implicitly.
        // For now, let's just save the computed stage if we were using an Order Stage model.
        // But we used a Selection Field on Order: new, in_progress, ready, done.

        // Map Stage -> State
        // New -> new
        // Prep -> in_progress
        // Ready -> ready
        // Done -> done

        // We need to map minStageId to a selection value.
        // Let's deduce it from the stage name or sequence.
        // Ideally we would update the Order's kitchen_state based on this.

        /* 
           Simplified Logic asked by User: 
           "Order changes stage when all lines are X"
           This implies Order Stage = Min(Line Stages)
        */

        // Update Order State in Backend??
        // Currently 'kitchen_state' is 'new', 'in_progress'...
        // Let's just focus on the VISUAL for now, or updating the selection if needed.
        // Actually, if all lines are DONE, we should hide the order.

        const allDone = lines.every(l => {
            const sId = l.kitchen_stage_id ? l.kitchen_stage_id[0] : 0;
            const s = this.state.stages.find(val => val.id === sId);
            return s && s.is_done_stage;
        });

        if (allDone) {
            // Mark Order as Done / Hide
            await this.orm.write("pos.order", [order.id], { kitchen_state: 'done' });
            // Remove from local list
            this.state.orders = this.state.orders.filter(o => o.id !== order.id);
        }
    }

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    toggleStageFilter(stageId) {
        this.state.filterStage = (this.state.filterStage === stageId) ? null : stageId;
    }

    // --- Data Loading ---

    async loadStages() {
        try {
            const stages = await this.orm.searchRead("pos.kitchen.stage", [], ["name", "sequence", "is_done_stage"], { order: "sequence asc" });
            this.state.stages = stages;
        } catch (e) {
            console.error("Error loading stages:", e);
        }
    }

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
            // Filter by Date (Last 72 hours) to avoid showing very old orders but allow recent tests
            const dateLimit = DateTime.now().minus({ hours: 72 }).toFormat("yyyy-MM-dd HH:mm:ss");
            const domain = [
                ['state', 'in', ['draft', 'paid', 'done', 'invoiced']],
                ['date_order', '>=', dateLimit]
            ];

            // Filter by POS Config Source
            const allowedConfigIds = this.state.currentDisplayConfig.pos_config_ids;
            if (allowedConfigIds && allowedConfigIds.length > 0) {
                domain.push(['config_id', 'in', allowedConfigIds]);
            }

            console.log("Loading orders with domain:", domain);
            const orders = await this.orm.searchRead("pos.order", domain, ["name", "pos_reference", "date_order", "lines", "kitchen_state"], { limit: 20, order: "date_order desc" });
            console.log("Fetched orders from DB:", orders.length);

            // Collect all line IDs
            const lineIds = orders.flatMap(o => o.lines);
            if (lineIds.length > 0) {
                // Fetch line details including stage
                const lines = await this.orm.searchRead("pos.order.line", [["id", "in", lineIds]], ["product_id", "qty", "order_id", "kitchen_stage_id"]);

                // Extract unique product IDs
                const productIds = [...new Set(lines.map(l => l.product_id[0]))];
                let productsMap = {}; // Map ProductID -> [CategoryIDs]

                if (productIds.length > 0) {
                    // Step 1: Fetch product_tmpl_id from product.product
                    const products = await this.orm.searchRead("product.product", [["id", "in", productIds]], ["product_tmpl_id"]);

                    // Step 2: Extract template IDs
                    const templateIds = [...new Set(products.map(p => p.product_tmpl_id[0]))];

                    // Step 3: Fetch pos_categ_ids from product.template
                    // NOTE: using pos_categ_ids (Many2many) for newer Odoo versions
                    const templates = await this.orm.searchRead("product.template", [["id", "in", templateIds]], ["pos_categ_ids"]);

                    // Step 4: Map Template ID -> Category IDs (Array)
                    const templateMap = {};
                    templates.forEach(t => templateMap[t.id] = t.pos_categ_ids || []);

                    // Step 5: Map Product ID -> Category IDs (Array)
                    products.forEach(p => {
                        const tmplId = p.product_tmpl_id[0];
                        productsMap[p.id] = templateMap[tmplId] || [];
                    });
                }

                // Prepare filtering set
                const allowedCategoryIds = this.state.currentDisplayConfig.pos_category_ids;
                const filterCategories = allowedCategoryIds && allowedCategoryIds.length > 0;
                // console.log("Filtering Enabled:", filterCategories, "Allowed Categories:", allowedCategoryIds);

                const linesMap = {};
                lines.forEach(l => linesMap[l.id] = l);

                const processedOrders = [];

                for (const order of orders) {
                    const expandedLines = [];
                    for (const lineId of order.lines) {
                        const line = linesMap[lineId];
                        if (!line) continue;

                        // Category Filter Logic
                        if (filterCategories) {
                            const pId = line.product_id[0];
                            const productCategs = productsMap[pId] || [];

                            // Check if ANY of the product's categories are in the allowed list
                            const hasAllowedCategory = productCategs.some(cId => allowedCategoryIds.includes(cId));

                            if (!hasAllowedCategory) {
                                continue;
                            }
                        }

                        // Default Stage Init (Visual)
                        if (!line.kitchen_stage_id && this.state.stages.length > 0) {
                            // Assign first stage visually if undefined
                            line.kitchen_stage_id = [this.state.stages[0].id, this.state.stages[0].name];
                        }

                        expandedLines.push(line);
                    }

                    // Only include order if it has lines relevant to this display
                    if (expandedLines.length > 0) {
                        // Check for Global Completion (if filtered by stage, or if we want to hide done orders)
                        // For now, include all, filter later in view
                        processedOrders.push({
                            id: order.id,
                            name: order.pos_reference || order.name,
                            table: '',
                            date_order: order.date_order,
                            kitchen_state: order.kitchen_state, // Pass backend state
                            lines: expandedLines
                        });
                    }
                }

                console.log("Processed Orders for Display:", processedOrders.length);
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
        let orders = this.state.orders;

        if (this.state.filterProduct) {
            orders = orders.filter(order =>
                order.lines.some(line => line.product_id && line.product_id[0] === this.state.filterProduct)
            );
        }

        if (this.state.filterStage) {
            orders = orders.filter(order =>
                order.lines.some(line => line.kitchen_stage_id && line.kitchen_stage_id[0] === this.state.filterStage)
            );
        }

        return orders;
    }

    // --- Actions ---

    toggleFilter(productId) {
        this.state.filterProduct = (this.state.filterProduct === productId) ? null : productId;
    }

    toggleStageFilter(stageId) {
        this.state.filterStage = (this.state.filterStage === stageId) ? null : stageId;
    }

    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
    }

    toggleAudio() {
        this.state.audioEnabled = !this.state.audioEnabled;
        if (this.state.audioEnabled) this.playSound();
    }
}

registry.category("actions").add("pos_kitchen_screen.main_view", KitchenMainComponent);
