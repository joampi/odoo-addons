from odoo import models, fields, api

class PosKitchenDisplay(models.Model):
    _name = 'pos.kitchen.display'
    _description = 'Kitchen Display Configuration'

    name = fields.Char(string='Display Name', required=True, help="E.g. Bar Screen, Main Kitchen")
    pos_config_ids = fields.Many2many(
        'pos.config', 
        string='Allowed POS', 
        help="Only orders from these POS sessions will be shown. Leave empty for all."
    )
    pos_category_ids = fields.Many2many(
        'pos.category', 
        string='Product Categories', 
        help="Only products in these categories will be shown. Leave empty for all."
    )

    # Per-Display Settings
    kitchen_sla_warning = fields.Integer(
        string='SLA Warning (Minutes)', 
        default=15, 
        help='Time in minutes before the order turns orange.'
    )
    kitchen_sla_critical = fields.Integer(
        string='SLA Critical (Minutes)', 
        default=30, 
        help='Time in minutes before the order turns red and blinks.'
    )
    enable_sound_notifications = fields.Boolean(
        string='Enable Sound Notifications', 
        default=True
    )

    @api.model
    def get_server_time(self):
        """Returns the current server time in UTC."""
        return fields.Datetime.now()
