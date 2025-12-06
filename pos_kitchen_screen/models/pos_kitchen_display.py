from odoo import models, fields

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
