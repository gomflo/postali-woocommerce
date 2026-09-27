<?php
/**
 * Validación opcional en el servidor al confirmar el pedido.
 *
 * Reglas:
 *   - Sólo aplica a direcciones de México.
 *   - Si Postali dice que el CP no existe, se rechaza.
 *   - Si el CP existe pero el estado elegido no corresponde, se rechaza.
 *   - Si la API no responde (red, timeout, 5xx), NUNCA se bloquea el pedido.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Hooks de validación para checkout clásico y de bloques.
 */
final class Postali_Validation {

	/**
	 * Registra hooks.
	 */
	public static function init() {
		if ( ! Postali_Options::enabled() || ! Postali_Options::is_on( 'postali_cp_server_validation' ) ) {
			return;
		}
		add_action( 'woocommerce_after_checkout_validation', array( __CLASS__, 'validate_classic' ), 10, 2 );
		add_action( 'woocommerce_store_api_checkout_update_order_from_request', array( __CLASS__, 'validate_blocks' ), 10, 1 );
	}

	/**
	 * Revisa una dirección. Devuelve un mensaje de error o '' si está bien (o no se pudo verificar).
	 *
	 * @param string $country  Código de país.
	 * @param string $postcode CP.
	 * @param string $state    Código de estado de WooCommerce.
	 * @param string $label    "facturación" o "envío", para el mensaje.
	 * @return string
	 */
	public static function check_address( $country, $postcode, $state, $label ) {
		if ( 'MX' !== $country || '' === (string) $postcode ) {
			return '';
		}

		$result = Postali_Api::lookup( $postcode );

		if ( Postali_Api::NOT_FOUND === $result['status'] ) {
			/* translators: 1: CP, 2: "facturación" o "envío". */
			return sprintf( __( 'El código postal %1$s de la dirección de %2$s no existe en el catálogo de SEPOMEX. Revísalo, por favor.', 'postali-codigos-postales' ), $postcode, $label );
		}

		if ( Postali_Api::FOUND === $result['status'] && '' !== (string) $state ) {
			$expected = Postali_States::code_from_response( $result['data'] );
			if ( '' !== $expected && $expected !== $state ) {
				/* translators: 1: CP, 2: nombre del estado, 3: "facturación" o "envío". */
				return sprintf( __( 'El código postal %1$s pertenece a %2$s. Revisa el estado de la dirección de %3$s.', 'postali-codigos-postales' ), $postcode, $result['data']['estado'], $label );
			}
		}

		return '';
	}

	/**
	 * Checkout clásico.
	 *
	 * @param array    $data   Datos ya sanitizados por WooCommerce.
	 * @param WP_Error $errors Errores acumulados.
	 */
	public static function validate_classic( $data, $errors ) {
		$groups = array( 'billing' => __( 'facturación', 'postali-codigos-postales' ) );
		if ( ! empty( $data['ship_to_different_address'] ) ) {
			$groups['shipping'] = __( 'envío', 'postali-codigos-postales' );
		}

		foreach ( $groups as $group => $label ) {
			$message = self::check_address(
				isset( $data[ $group . '_country' ] ) ? (string) $data[ $group . '_country' ] : '',
				isset( $data[ $group . '_postcode' ] ) ? Postali_Api::normalize( $data[ $group . '_postcode' ] ) : '',
				isset( $data[ $group . '_state' ] ) ? (string) $data[ $group . '_state' ] : '',
				$label
			);
			if ( '' !== $message ) {
				$errors->add( 'postali_' . $group . '_postcode', esc_html( $message ) );
			}
		}
	}

	/**
	 * Checkout de bloques (Store API).
	 *
	 * @param WC_Order $order Pedido en construcción.
	 * @throws \Automattic\WooCommerce\StoreApi\Exceptions\RouteException Si el CP no es válido.
	 */
	public static function validate_blocks( $order ) {
		if ( ! class_exists( \Automattic\WooCommerce\StoreApi\Exceptions\RouteException::class ) ) {
			return;
		}

		$groups = array(
			'billing'  => __( 'facturación', 'postali-codigos-postales' ),
			'shipping' => __( 'envío', 'postali-codigos-postales' ),
		);

		foreach ( $groups as $group => $label ) {
			if ( 'shipping' === $group && ! $order->needs_shipping_address() ) {
				continue;
			}
			$message = self::check_address(
				(string) call_user_func( array( $order, 'get_' . $group . '_country' ) ),
				Postali_Api::normalize( (string) call_user_func( array( $order, 'get_' . $group . '_postcode' ) ) ),
				(string) call_user_func( array( $order, 'get_' . $group . '_state' ) ),
				$label
			);
			if ( '' !== $message ) {
				throw new \Automattic\WooCommerce\StoreApi\Exceptions\RouteException(
					'postali_invalid_postcode',
					esc_html( $message ),
					400
				);
			}
		}
	}
}
