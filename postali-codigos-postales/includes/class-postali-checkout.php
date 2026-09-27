<?php
/**
 * Checkout clásico (shortcode [woocommerce_checkout]) y ajustes de campos comunes.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Carga el JS del checkout clásico, etiqueta la colonia y, si se elige,
 * añade un campo "Colonia" propio.
 */
final class Postali_Checkout {

	/**
	 * Id del campo adicional (API de campos de WooCommerce Blocks). Se usa el
	 * mismo almacenamiento en el checkout clásico para que ambos coincidan.
	 */
	const FIELD_ID = 'postali/colonia';

	/**
	 * Registra hooks.
	 */
	public static function init() {
		if ( ! Postali_Options::enabled() ) {
			return;
		}

		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue' ) );
		add_filter( 'woocommerce_get_country_locale', array( __CLASS__, 'country_locale' ) );

		if ( Postali_Options::dedicated_colonia() ) {
			add_filter( 'woocommerce_billing_fields', array( __CLASS__, 'add_billing_field' ) );
			add_filter( 'woocommerce_shipping_fields', array( __CLASS__, 'add_shipping_field' ) );
			add_action( 'woocommerce_checkout_create_order', array( __CLASS__, 'save_classic_field' ), 10, 2 );
			add_filter( 'woocommerce_checkout_get_value', array( __CLASS__, 'prefill_classic_field' ), 10, 2 );
			add_action( 'woocommerce_customer_save_address', array( __CLASS__, 'mirror_account_field' ), 10, 2 );
			add_filter( 'woocommerce_order_formatted_billing_address', array( __CLASS__, 'formatted_billing' ), 10, 2 );
			add_filter( 'woocommerce_order_formatted_shipping_address', array( __CLASS__, 'formatted_shipping' ), 10, 2 );
			add_filter( 'woocommerce_formatted_address_replacements', array( __CLASS__, 'address_replacements' ), 10, 2 );
			add_filter( 'woocommerce_localisation_address_formats', array( __CLASS__, 'address_formats' ) );
		}
	}

	/**
	 * Registra los scripts compartidos (núcleo) y el del checkout clásico.
	 */
	public static function register_scripts() {
		if ( ! wp_script_is( 'postali-cp-core', 'registered' ) ) {
			wp_register_script(
				'postali-cp-core',
				POSTALI_CP_URL . 'assets/js/postali-core.js',
				array(),
				POSTALI_CP_VERSION,
				true
			);
			wp_add_inline_script(
				'postali-cp-core',
				'window.postaliCpConfig = ' . wp_json_encode( Postali_Options::js_config() ) . ';',
				'before'
			);
		}
		if ( ! wp_style_is( 'postali-cp', 'registered' ) ) {
			wp_register_style( 'postali-cp', POSTALI_CP_URL . 'assets/css/postali-checkout.css', array(), POSTALI_CP_VERSION );
		}
	}

	/**
	 * Encola el JS sólo en la página de checkout (y en "Mi cuenta > Direcciones").
	 */
	public static function enqueue() {
		$is_checkout = function_exists( 'is_checkout' ) && is_checkout() && ! is_order_received_page();
		$is_address  = function_exists( 'is_wc_endpoint_url' ) && is_wc_endpoint_url( 'edit-address' );
		if ( ! $is_checkout && ! $is_address ) {
			return;
		}
		// El checkout de bloques carga su propio script (Postali_Blocks).
		if ( $is_checkout && ! $is_address && has_block( 'woocommerce/checkout' ) ) {
			return;
		}

		self::register_scripts();
		wp_enqueue_style( 'postali-cp' );
		wp_enqueue_script(
			'postali-cp-classic',
			POSTALI_CP_URL . 'assets/js/postali-classic.js',
			array( 'jquery', 'postali-cp-core' ),
			POSTALI_CP_VERSION,
			true
		);
	}

	/**
	 * Ajustes de campos para México: el CP sube antes de la calle y address_2
	 * se etiqueta "Colonia" (WooCommerce la oculta por defecto como
	 * "Departamento, suite…").
	 *
	 * @param array $locale Configuración por país.
	 * @return array
	 */
	public static function country_locale( $locale ) {
		if ( ! isset( $locale['MX'] ) || ! is_array( $locale['MX'] ) ) {
			$locale['MX'] = array();
		}

		// CP antes de calle/colonia: el cliente lo escribe primero y el resto se llena solo.
		if ( Postali_Options::is_on( 'postali_cp_postcode_first' ) ) {
			$locale['MX']['postcode'] = array_merge(
				isset( $locale['MX']['postcode'] ) && is_array( $locale['MX']['postcode'] ) ? $locale['MX']['postcode'] : array(),
				array( 'priority' => 45 )
			);
		}

		if ( Postali_Options::is_on( 'postali_cp_fill_colonia' ) && ! Postali_Options::dedicated_colonia() ) {
			$locale['MX']['address_2'] = array_merge(
				isset( $locale['MX']['address_2'] ) && is_array( $locale['MX']['address_2'] ) ? $locale['MX']['address_2'] : array(),
				array(
					'label'       => __( 'Colonia', 'postali-codigos-postales' ),
					'label_class' => array(),
					'placeholder' => __( 'Colonia', 'postali-codigos-postales' ),
				)
			);
		}

		return $locale;
	}

	/**
	 * Definición del campo propio "Colonia" para el checkout clásico.
	 *
	 * @param string $prefix billing|shipping.
	 * @return array
	 */
	private static function field_definition( $prefix ) {
		return array(
			'label'        => __( 'Colonia', 'postali-codigos-postales' ),
			'required'     => false,
			'class'        => array( 'form-row-wide', 'postali-cp-colonia-row' ),
			'autocomplete' => $prefix . ' address-level3',
			'priority'     => 65,
		);
	}

	/**
	 * Añade billing_postali_colonia.
	 *
	 * @param array $fields Campos de facturación.
	 * @return array
	 */
	public static function add_billing_field( $fields ) {
		$fields['billing_postali_colonia'] = self::field_definition( 'billing' );
		return $fields;
	}

	/**
	 * Añade shipping_postali_colonia.
	 *
	 * @param array $fields Campos de envío.
	 * @return array
	 */
	public static function add_shipping_field( $fields ) {
		$fields['shipping_postali_colonia'] = self::field_definition( 'shipping' );
		return $fields;
	}

	/**
	 * Colonia guardada en un pedido (campo propio).
	 *
	 * @param WC_Order $order Pedido.
	 * @param string   $group billing|shipping.
	 * @return string
	 */
	private static function order_colonia( $order, $group ) {
		if ( ! $order instanceof WC_Order ) {
			return '';
		}
		return (string) $order->get_meta( '_wc_' . $group . '/' . self::FIELD_ID );
	}

	/**
	 * Añade {colonia} a la dirección de facturación formateada (correos, admin, gracias).
	 *
	 * @param array    $address Partes de la dirección.
	 * @param WC_Order $order   Pedido.
	 * @return array
	 */
	public static function formatted_billing( $address, $order ) {
		if ( is_array( $address ) ) {
			$address['colonia'] = self::order_colonia( $order, 'billing' );
		}
		return $address;
	}

	/**
	 * Añade {colonia} a la dirección de envío formateada.
	 *
	 * @param array    $address Partes de la dirección.
	 * @param WC_Order $order   Pedido.
	 * @return array
	 */
	public static function formatted_shipping( $address, $order ) {
		if ( is_array( $address ) ) {
			$address['colonia'] = self::order_colonia( $order, 'shipping' );
		}
		return $address;
	}

	/**
	 * Reemplazo del marcador {colonia}.
	 *
	 * @param array $replacements Reemplazos.
	 * @param array $args         Partes de la dirección.
	 * @return array
	 */
	public static function address_replacements( $replacements, $args ) {
		$replacements['{colonia}'] = isset( $args['colonia'] ) ? (string) $args['colonia'] : '';
		return $replacements;
	}

	/**
	 * Formato de dirección de México con la colonia después de la línea 2.
	 *
	 * @param array $formats Formatos por país.
	 * @return array
	 */
	public static function address_formats( $formats ) {
		$base = isset( $formats['MX'] ) ? $formats['MX'] : ( isset( $formats['default'] ) ? $formats['default'] : '' );
		if ( '' !== $base && false === strpos( $base, '{colonia}' ) ) {
			$formats['MX'] = str_replace( '{address_2}', "{address_2}\n{colonia}", $base );
		}
		return $formats;
	}

	/**
	 * Guarda la colonia del checkout clásico con las mismas claves de meta que
	 * usa el checkout de bloques (_wc_billing/postali/colonia), para que el
	 * pedido la muestre igual venga de donde venga.
	 *
	 * El nonce ya lo verificó WC_Checkout::process_checkout() antes de este hook;
	 * aquí se lee el valor ya validado por WooCommerce en $data.
	 *
	 * @param WC_Order $order Pedido.
	 * @param array    $data  Datos del checkout ya sanitizados por WooCommerce.
	 */
	public static function save_classic_field( $order, $data ) {
		foreach ( array( 'billing', 'shipping' ) as $group ) {
			$key = $group . '_postali_colonia';
			if ( ! isset( $data[ $key ] ) ) {
				continue;
			}
			$value = sanitize_text_field( (string) $data[ $key ] );
			$order->update_meta_data( '_wc_' . $group . '/' . self::FIELD_ID, $value );
			// WooCommerce ya guarda "_{$key}" por su cuenta; se borra para no duplicar.
			$order->delete_meta_data( '_' . $key );

			// También en el cliente, con la clave que usa el checkout de bloques,
			// para que la próxima compra (clásica o de bloques) la tenga prellenada.
			$customer_id = $order->get_customer_id();
			if ( $customer_id ) {
				update_user_meta( $customer_id, '_wc_' . $group . '/' . self::FIELD_ID, $value );
			}
		}
	}

	/**
	 * "Mi cuenta > Direcciones" guarda billing_postali_colonia como meta del
	 * usuario; se copia a la clave del checkout de bloques para que ambos
	 * checkouts la prellenen. (WooCommerce ya verificó el nonce antes de este hook.)
	 *
	 * @param int    $user_id      Usuario.
	 * @param string $load_address billing|shipping.
	 */
	public static function mirror_account_field( $user_id, $load_address ) {
		if ( 'billing' !== $load_address && 'shipping' !== $load_address ) {
			return;
		}
		$value = get_user_meta( $user_id, $load_address . '_postali_colonia', true );
		update_user_meta( $user_id, '_wc_' . $load_address . '/' . self::FIELD_ID, sanitize_text_field( (string) $value ) );
	}

	/**
	 * Prellena el campo propio del checkout clásico con lo guardado por cualquiera de los dos checkouts.
	 *
	 * @param mixed  $value Valor que propone WooCommerce (null si no hay).
	 * @param string $input Nombre del campo.
	 * @return mixed
	 */
	public static function prefill_classic_field( $value, $input ) {
		if ( null !== $value && '' !== $value ) {
			return $value;
		}
		if ( 'billing_postali_colonia' !== $input && 'shipping_postali_colonia' !== $input ) {
			return $value;
		}
		$user_id = get_current_user_id();
		if ( ! $user_id ) {
			return $value;
		}
		$group  = 0 === strpos( $input, 'billing_' ) ? 'billing' : 'shipping';
		$stored = get_user_meta( $user_id, '_wc_' . $group . '/' . self::FIELD_ID, true );
		return '' !== $stored ? $stored : $value;
	}
}
