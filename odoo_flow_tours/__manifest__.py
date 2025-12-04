{
    'name': "Director Odoo Tours",
    'summary': "Guided tours for CRM to Delivery flow",
    'description': """
        Technical module that adds a guided tour (Onboarding) to test the complete flow:
        CRM -> Sale -> Delivery.
    """,
    'author': "Antigravity",
    'category': 'Technical',
    'version': '0.1',
    'depends': ['base', 'web', 'crm', 'sale_management', 'stock'],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'odoo_flow_tours/static/src/js/tour_crm_sale.js',
        ],
    },
    'license': 'LGPL-3',
}
