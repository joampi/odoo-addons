/** @odoo-module **/

import { Component, useState, onWillStart, onMounted, onWillUnmount, useEffect } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
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
            statusRequest: 'normal', // normal, warning, critical
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
        // Assuming date_order is ISO string or fetched as such. 
        // If it's pure Odoo string, might need parsing. 
        // For mock data/standard flow, we handle ISO or standard Odoo datetime string.
        let orderDate = DateTime.fromISO(this.props.order.date_order);
        if (!orderDate.isValid) {
            // Fallback for Odoo server usage if not ISO
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
            filterProduct: null,
            audioEnabled: false,
        });

        this.config = {
            slaWarning: 15, // Default
            slaCritical: 30, // Default
            enableSound: true
        };

        // Load Config and Orders
        onWillStart(async () => {
            await this.loadConfig();
            await this.loadOrders();
        });

        // Bus Listener Setup for Odoo 16+ / 17 / 18+ (Generic)
        // We use the effect to manage subscription lifecycle
        useEffect(() => {
            const channel = "kitchen_new_order";
            // In real Odoo this requires backend to target this specific channel
            // or we use 'pos.order' model updates if relying on standard bus
            // For this task, strict implementation of "kitchen_new_order" event.

            const listener = (payload) => this.onNewOrder(payload);

            this.bus.subscribe("kitchen_new_order", listener);
            this.bus.addChannel("kitchen_new_order"); // Ensure channel is added if needed by generic bus

            return () => {
                this.bus.unsubscribe("kitchen_new_order", listener);
            };
        });
    }

    async loadConfig() {
        try {
            const configs = await this.orm.searchRead("pos.config", [], ["kitchen_sla_warning", "kitchen_sla_critical", "enable_sound_notifications"], { limit: 1 });
            if (configs && configs.length) {
                this.config.slaWarning = configs[0].kitchen_sla_warning;
                this.config.slaCritical = configs[0].kitchen_sla_critical;
                this.config.enableSound = configs[0].enable_sound_notifications;
            }
        } catch (e) {
            console.warn("Could not load POS Config, using defaults. Error:", e);
        }
    }

    async loadOrders() {
        // MOCK DATA implementation as backend logic for fetching orders wasn't requested 
        // but UI needs to show something.
        // In production: replace with this.orm.searchRead('pos.order', [['state', 'in', ['paid', 'invoiced']]], ...)
        // or a custom controller.

        const now = DateTime.now();

        this.state.orders = [
            {
                id: 1,
                name: 'Order 0001',
                table: 'Table 1',
                date_order: now.minus({ minutes: 5, seconds: 10 }).toISO(),
                lines: [
                    { id: 1, product_id: [10, 'Hamburguesa'], qty: 2 },
                    { id: 2, product_id: [11, 'Patatas Fritas'], qty: 1 },
                    { id: 3, product_id: [12, 'Coca Cola'], qty: 2 },
                ]
            },
            {
                id: 2,
                name: 'Order 0002',
                table: 'Table 3',
                date_order: now.minus({ minutes: 16 }).toISO(), // Should be Warning
                lines: [
                    { id: 4, product_id: [10, 'Hamburguesa'], qty: 1 },
                    { id: 5, product_id: [13, 'Helado'], qty: 1 },
                ]
            },
            {
                id: 3,
                name: 'Order 0003',
                table: 'T-TakeAway',
                date_order: now.minus({ minutes: 32 }).toISO(), // Should be Critical
                lines: [
                    { id: 6, product_id: [11, 'Patatas Fritas'], qty: 5 },
                ]
            },
        ];
    }

    onNewOrder(payload) {
        // Payload handling would go here.
        // For now, we simulate a refresh or adding the payload
        // this.loadOrders(); 

        // Add a dummy order for demo effect if payload is empty/test
        const now = DateTime.now();
        this.state.orders.push({
            id: Math.random(),
            name: 'New Order',
            date_order: now.toISO(),
            lines: [{ id: 99, product_id: [99, 'New Item'], qty: 1 }]
        });

        this.playSound();
        this.notification.add("New Order in Kitchen!", { type: "success" });
    }

    playSound() {
        if (!this.config.enableSound) return;

        // Simple beep or local file
        // Ensure static audio file exists or use browser synth
        // Using browser synth for reliability without asset file
        if (window.speechSynthesis) {
            const msg = new SpeechSynthesisUtterance("New Order");
            window.speechSynthesis.speak(msg);
        } else {
            // Placeholder for actual file
            console.log("Playing sound...");
        }
    }

    // --- Computed / Getters ---

    get aggregatedProducts() {
        const counts = {};
        for (const order of this.state.orders) {
            for (const line of order.lines) {
                // line.product_id is [id, name]
                const pName = line.product_id[1];
                const pId = line.product_id[0];
                if (!counts[pId]) {
                    counts[pId] = { id: pId, name: pName, qty: 0 };
                }
                counts[pId].qty += line.qty;
            }
        }
        // Return array sorted by name
        return Object.values(counts).sort((a, b) => a.name.localeCompare(b.name));
    }

    get filteredOrders() {
        if (!this.state.filterProduct) return this.state.orders;

        // filterProduct is the Product ID
        return this.state.orders.filter(order =>
            order.lines.some(line => line.product_id[0] === this.state.filterProduct)
        );
    }

    // --- Actions ---

    toggleFilter(productId) {
        if (this.state.filterProduct === productId) {
            this.state.filterProduct = null;
        } else {
            this.state.filterProduct = productId;
        }
    }

    toggleAudio() {
        this.state.audioEnabled = !this.state.audioEnabled;
        // User interaction allows subsequent auto-play
        if (this.state.audioEnabled) {
            this.playSound(); // Test sound
        }
    }
}

registry.category("actions").add("pos_kitchen_screen.main_view", KitchenMainComponent);
