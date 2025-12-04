/** @odoo-module **/

import { registry } from "@web/core/registry";

registry.category("web_tours").add("tour_crm_to_delivery", {
    url: "/odoo",
    steps: () => [
        {
            trigger: '.o_app[data-menu-xmlid="crm.crm_menu_root"]',
            content: 'Open CRM menu',
            run: "click",
        },
        {
            trigger: 'button.o_list_button_add',
            content: 'Create new Lead',
            run: "click",
        },
        {
            trigger: 'div[name="name"] input',
            content: 'Write Lead name',
            run: "edit Lead de Prueba",
        },
        {
            trigger: 'button.o_form_button_save',
            content: 'Save Lead',
            run: "click",
        },
        // Wait for save to complete and maybe go back to list or stay in form?
        // The instructions say "Entrar en el Lead creado".
        // If we just saved, we are likely in the form view of the lead.
        // But if 'button.o_list_button_add' was used, it might be a dialog or a form view.
        // Assuming standard CRM flow, 'New' opens a form or a quick create.
        // Let's assume we are in the form.
        {
            trigger: 'button[name="action_new_quotation"]',
            content: 'Click New Quotation',
            run: "click",
        },
        {
            trigger: 'div[name="partner_id"] input',
            content: 'Select Customer',
            run: "edit Azure Interior",
        },
        {
            trigger: '.ui-menu-item > a:contains("Azure Interior")',
            content: 'Select Azure Interior from dropdown',
            run: "click",
        },
        {
            trigger: 'a:contains("Add a product")',
            content: 'Add a product',
            run: "click",
        },
        {
            trigger: 'div[name="product_template_id"] input',
            content: 'Select Product',
            run: "edit Desk",
        },
        {
            trigger: '.ui-menu-item > a:contains("Desk")',
            content: 'Select Desk from dropdown',
            run: "click",
        },
        {
            trigger: 'button[name="action_confirm"]',
            content: 'Confirm Sale',
            run: "click",
        },
        {
            trigger: 'div[name="delivery_count"]',
            content: 'Go to Delivery',
            run: "click",
        },
        {
            trigger: 'button[name="button_validate"]',
            content: 'Validate Delivery',
            run: "click",
        },
        // Modal for immediate transfer might appear
        {
            trigger: 'button[name="process"]',
            content: 'Confirm Immediate Transfer if needed',
            run: "click",
        }
    ]
});
