from odoo import models, api

class PosOrder(models.Model):
    _inherit = 'pos.order'

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
        # We fetch the same data the JS expects locally or we let JS fetch it.
        # Sending a 'ping' is cleaner, JS refreshes data.
        payload = {
            'order_id': order.id,
            'name': order.name,
        }
        self.env['bus.bus']._sendone('kitchen_new_order', 'kitchen_new_order', payload)
