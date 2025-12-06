from odoo import models, fields, api

class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'

    kitchen_stage_id = fields.Many2one('pos.kitchen.stage', string="Kitchen Stage", copy=False)


class PosOrder(models.Model):
    _inherit = 'pos.order'

    kitchen_state = fields.Selection([
        ('new', 'New'),
        ('in_progress', 'In Progress'),
        ('ready', 'Ready'),
        ('done', 'Done')
    ], string='Kitchen Status', default='new', index=True)

    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        for order in orders:
            self._notify_kitchen(order)
        return orders

    def write(self, vals):
        res = super().write(vals)
        # Verify if significant changes happened to notify kitchen
        # For simple demo: Notify on any write to keep screen updated
        for order in self:
            self._notify_kitchen(order)
        return res

    def _notify_kitchen(self, order):
        """
        Broadcasts the new/updated order to the Kitchen Screen via Bus.
        Target Channel: 'kitchen_new_order'
        """
        domain = [('id', '=', order.id)]
        payload = {
            'order_id': order.id,
            'name': order.name,
        }
        self.env['bus.bus']._sendone('kitchen_new_order', 'kitchen_new_order', payload)
