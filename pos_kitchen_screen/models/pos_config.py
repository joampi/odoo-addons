from odoo import fields, models

class PosConfig(models.Model):
    _inherit = 'pos.config'

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
