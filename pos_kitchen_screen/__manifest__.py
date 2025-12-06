# -*- coding: utf-8 -*-
{
    'name': 'POS Kitchen Screen',
    'version': '19.0.1.0.0',
    'category': 'Sales/Point of Sale',
    'summary': 'Professional Kitchen Screen for Odoo POS',
    'description': """
POS Kitchen Screen
==================
Standalone Kitchen Display System (KDS) for Odoo Point of Sale.

Important:
Place your icon file in: pos_kitchen_screen/static/description/icon.png

Features:
- Independent Application interface.
- Real-time order updates via Bus.
- SLA Timer with warning and critical states.
- Sound notifications.
    """,
    'author': 'PabloBar',
    'depends': ['point_of_sale', 'web'],
    'data': [
        'security/ir.model.access.csv',
        'views/kitchen_menu.xml',
        'views/res_config_settings_view.xml',
        'views/pos_kitchen_display_view.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'pos_kitchen_screen/static/src/kitchen_screen/**/*',
        ],
    },
    'application': True,
    'installable': True,
    'license': 'LGPL-3',
}
