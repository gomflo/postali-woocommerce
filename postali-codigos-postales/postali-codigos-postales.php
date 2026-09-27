<?php
/**
 * Plugin Name:          Postali — Códigos postales de México
 * Plugin URI:           https://postali.app/api
 * Description:          Autocompleta estado, municipio y colonia en el checkout de WooCommerce a partir del código postal mexicano, usando la API pública y gratuita de Postali (datos de SEPOMEX).
 * Version:              1.0.0
 * Requires at least:    6.5
 * Requires PHP:         7.4
 * Requires Plugins:     woocommerce
 * Author:               Postali
 * Author URI:           https://postali.app
 * License:              GPLv2 or later
 * License URI:          https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:          postali-codigos-postales
 * Domain Path:          /languages
 * WC requires at least: 8.9
 * WC tested up to:      11.1
 *
 * @package Postali_Codigos_Postales
 */

/*
Postali — Códigos postales de México
Copyright (C) 2026 Postali

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation; either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/

defined( 'ABSPATH' ) || exit;

define( 'POSTALI_CP_VERSION', '1.0.0' );
define( 'POSTALI_CP_FILE', __FILE__ );
define( 'POSTALI_CP_DIR', plugin_dir_path( __FILE__ ) );
define( 'POSTALI_CP_URL', plugin_dir_url( __FILE__ ) );

require_once POSTALI_CP_DIR . 'includes/class-postali-states.php';
require_once POSTALI_CP_DIR . 'includes/class-postali-options.php';
require_once POSTALI_CP_DIR . 'includes/class-postali-api.php';
require_once POSTALI_CP_DIR . 'includes/class-postali-checkout.php';
require_once POSTALI_CP_DIR . 'includes/class-postali-blocks.php';
require_once POSTALI_CP_DIR . 'includes/class-postali-validation.php';

/**
 * Declara compatibilidad con HPOS y con el checkout de bloques.
 */
add_action(
	'before_woocommerce_init',
	static function () {
		if ( class_exists( \Automattic\WooCommerce\Utilities\FeaturesUtil::class ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'custom_order_tables', POSTALI_CP_FILE, true );
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility( 'cart_checkout_blocks', POSTALI_CP_FILE, true );
		}
	}
);

/**
 * Arranque. Sólo hace algo si WooCommerce está activo.
 */
add_action(
	'plugins_loaded',
	static function () {
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		add_filter(
			'woocommerce_get_settings_pages',
			static function ( $pages ) {
				require_once POSTALI_CP_DIR . 'includes/class-postali-settings.php';
				$pages[] = new Postali_Settings();
				return $pages;
			}
		);

		add_filter(
			'plugin_action_links_' . plugin_basename( POSTALI_CP_FILE ),
			static function ( $links ) {
				$url = admin_url( 'admin.php?page=wc-settings&tab=postali' );
				array_unshift( $links, '<a href="' . esc_url( $url ) . '">' . esc_html__( 'Ajustes', 'postali-codigos-postales' ) . '</a>' );
				return $links;
			}
		);

		Postali_Checkout::init();
		Postali_Blocks::init();
		Postali_Validation::init();
	}
);
