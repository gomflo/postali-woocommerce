<?php
/**
 * Lectura centralizada de los ajustes del plugin.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Ajustes con sus valores por defecto.
 */
final class Postali_Options {

	/**
	 * Valores por defecto. El crédito "Datos: Postali" es opt-in (guía #10 de WordPress.org).
	 *
	 * @var array<string,string>
	 */
	const DEFAULTS = array(
		'postali_cp_enabled'           => 'yes',
		'postali_cp_fill_state'        => 'yes',
		'postali_cp_fill_city'         => 'yes',
		'postali_cp_city_source'       => 'municipio',
		'postali_cp_fill_colonia'      => 'yes',
		'postali_cp_colonia_field'     => 'address_2',
		'postali_cp_postcode_first'    => 'yes',
		'postali_cp_server_validation' => 'no',
		'postali_cp_attribution'       => 'no',
	);

	/**
	 * Lee un ajuste con su valor por defecto.
	 *
	 * @param string $key Nombre de la opción.
	 * @return string
	 */
	public static function get( $key ) {
		$default = isset( self::DEFAULTS[ $key ] ) ? self::DEFAULTS[ $key ] : '';
		return (string) get_option( $key, $default );
	}

	/**
	 * Ajuste sí/no.
	 *
	 * @param string $key Nombre de la opción.
	 * @return bool
	 */
	public static function is_on( $key ) {
		return 'yes' === self::get( $key );
	}

	/**
	 * ¿Está activo el autocompletado?
	 *
	 * @return bool
	 */
	public static function enabled() {
		return self::is_on( 'postali_cp_enabled' );
	}

	/**
	 * ¿La colonia va en un campo propio (en vez de address_2)?
	 *
	 * @return bool
	 */
	public static function dedicated_colonia() {
		return self::is_on( 'postali_cp_fill_colonia' ) && 'dedicated' === self::get( 'postali_cp_colonia_field' );
	}

	/**
	 * Configuración que se entrega al JavaScript del checkout.
	 *
	 * @return array
	 */
	public static function js_config() {
		return array(
			'apiBase'      => esc_url_raw( Postali_Api::base_url() ),
			'fillState'    => self::is_on( 'postali_cp_fill_state' ),
			'fillCity'     => self::is_on( 'postali_cp_fill_city' ),
			'citySource'   => 'ciudad' === self::get( 'postali_cp_city_source' ) ? 'ciudad' : 'municipio',
			'fillColonia'  => self::is_on( 'postali_cp_fill_colonia' ),
			'coloniaField' => self::dedicated_colonia() ? 'dedicated' : 'address_2',
			'attribution'  => self::is_on( 'postali_cp_attribution' ),
			'creditUrl'    => 'https://postali.app/mx',
			'i18n'         => array(
				'colonia'      => __( 'Colonia', 'postali-codigos-postales' ),
				'choose'       => __( 'Elige tu colonia…', 'postali-codigos-postales' ),
				'other'        => __( 'Otra (escribirla a mano)', 'postali-codigos-postales' ),
				'loading'      => __( 'Buscando código postal…', 'postali-codigos-postales' ),
				'notFound'     => __( 'No encontramos ese código postal. Revisa los dígitos o llena la dirección a mano.', 'postali-codigos-postales' ),
				'networkError' => __( 'No pudimos consultar el código postal. Puedes llenar la dirección a mano.', 'postali-codigos-postales' ),
				/* translators: Texto del enlace de crédito opcional. */
				'credit'       => __( 'Datos: Postali', 'postali-codigos-postales' ),
			),
		);
	}
}
