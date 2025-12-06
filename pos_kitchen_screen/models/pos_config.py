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

class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    # In Odoo POS, settings usually relate to the *current* POS config being edited.
    # We add related fields to the pos_config_id (standard Odoo pattern for POS settings).
    pos_kitchen_sla_warning = fields.Integer(related='pos_config_id.kitchen_sla_warning', readonly=False)
    pos_kitchen_sla_critical = fields.Integer(related='pos_config_id.kitchen_sla_critical', readonly=False)
    pos_enable_sound_notifications = fields.Boolean(related='pos_config_id.enable_sound_notifications', readonly=False)
