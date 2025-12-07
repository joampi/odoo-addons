from odoo import models, fields, api

class ProductTemplate(models.Model):
    _inherit = 'product.template'

    recipe_file = fields.Binary(string= "Recipe (PDF)", attachment=True)
    recipe_filename = fields.Char(string="Recipe Filename")
    has_recipe = fields.Boolean(compute="_compute_has_recipe", store=True)

    @api.depends('recipe_file')
    def _compute_has_recipe(self):
        for record in self:
            record.has_recipe = bool(record.recipe_file)
