from odoo import models, api
import random

class PosOrder(models.Model):
    _inherit = 'pos.order'

    @api.model
    def get_customer_history_summary(self, partner_id):
        """
        Returns a summary of the customer's history for the AI Agent.
        In a real scenario, this would compute actual stats.
        Here we mock it for the 'AI' feeling.
        """
        if not partner_id:
            return None

        # Mocking AI analysis
        # In real life: search count of orders, favorite products, avg spend.
        partner = self.env['res.partner'].browse(partner_id)
        
        # Random "AI" Sentiment
        sentiments = ['Happy', 'Demanding', 'Regular', 'VIP', 'New']
        sentiment = sentiments[partner_id % 5]
        
        return {
            'partner_name': partner.name,
            'total_orders': 12 + (partner_id % 10), # Mock
            'favorite_dish': 'Hamburguesa' if partner_id % 2 == 0 else 'Pizza',
            'last_visit': '2 days ago',
            'ai_sentiment': sentiment,
            'ai_note': f"Customer often prefers { 'well-done' if partner_id % 2 else 'extra sauce' }. Suggest the special of the day."
        }
