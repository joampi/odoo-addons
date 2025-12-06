from odoo import models, fields

class PosKitchenStage(models.Model):
    _name = 'pos.kitchen.stage'
    _description = 'Kitchen Order Stages'
    _order = 'sequence, id'

    name = fields.Char(string='Stage Name', required=True, translate=True)
    sequence = fields.Integer(default=10, help="Used to order stages.")
    is_done_stage = fields.Boolean(string="Is Done Stage", help="Items in this stage are considered done.")
    fold = fields.Boolean(string="Folded in Kanban", default=False)
