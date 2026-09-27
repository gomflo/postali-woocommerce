<?php
/**
 * Integración con el checkout de bloques de WooCommerce.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Encola el JS del checkout de bloques y, si la colonia va en un campo propio,
 * lo registra con la API de campos adicionales (WooCommerce 8.9+).
 */
final class Postali_Blocks {

	/**
	 * Registra hooks.
	 */
	public static function init() {
		if ( ! Postali_Options::enabled() ) {
			return;
		}

		add_filter( 'render_block_woocommerce/checkout', array( __CLASS__, 'enqueue_on_render' ) );

		if ( Postali_Options::dedicated_colonia() ) {
			add_action( 'woocommerce_init', array( __CLASS__, 'register_field' ) );
		}
	}

	/**
	 * Encola el script cuando se pinta el bloque de checkout (así no se carga en otras páginas).
	 *
	 * @param string $content HTML del bloque.
	 * @return string
	 */
	public static function enqueue_on_render( $content ) {
		Postali_Checkout::register_scripts();
		wp_enqueue_style( 'postali-cp' );
		wp_enqueue_script(
			'postali-cp-blocks',
			POSTALI_CP_URL . 'assets/js/postali-blocks.js',
			array( 'postali-cp-core', 'wp-data', 'wc-blocks-data-store' ),
			POSTALI_CP_VERSION,
			true
		);
		return $content;
	}

	/**
	 * Campo "Colonia" propio en la sección de dirección, visible sólo para México.
	 */
	public static function register_field() {
		if ( ! function_exists( 'woocommerce_register_additional_checkout_field' ) ) {
			return;
		}

		$field = array(
			'id'                         => Postali_Checkout::FIELD_ID,
			'label'                      => __( 'Colonia', 'postali-codigos-postales' ),
			'optionalLabel'              => __( 'Colonia (opcional)', 'postali-codigos-postales' ),
			'location'                   => 'address',
			'type'                       => 'text',
			'required'                   => false,
			// La colonia ya va dentro de la dirección formateada (ver Postali_Checkout::address_formats).
			'show_in_order_confirmation' => false,
			'attributes'                 => array(
				'autocomplete' => 'address-level3',
			),
		);

		// Las reglas condicionales (ocultar fuera de México) existen desde WooCommerce 9.9.
		if ( defined( 'WC_VERSION' ) && version_compare( WC_VERSION, '9.9', '>=' ) ) {
			$field['hidden'] = array(
				'type'       => 'object',
				'properties' => array(
					'customer' => array(
						'properties' => array(
							'address' => array(
								'properties' => array(
									'country' => array(
										'not' => array( 'const' => 'MX' ),
									),
								),
							),
						),
					),
				),
			);
		}

		woocommerce_register_additional_checkout_field( $field );
	}
}
