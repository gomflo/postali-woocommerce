<?php
/**
 * Cliente de servidor para la API de Postali (sólo se usa en la validación opcional).
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Consulta /api/v1/mx/cp/{cp} con caché en transients.
 */
final class Postali_Api {

	/**
	 * Resultado: el CP existe.
	 */
	const FOUND = 'found';

	/**
	 * Resultado: la API respondió que el CP no existe o tiene formato inválido.
	 */
	const NOT_FOUND = 'not_found';

	/**
	 * Resultado: no se pudo consultar (red, timeout, 5xx, JSON roto). Nunca bloquea el checkout.
	 */
	const UNAVAILABLE = 'unavailable';

	/**
	 * URL base de la API. Filtrable para pruebas o un espejo propio.
	 *
	 * @return string
	 */
	public static function base_url() {
		/**
		 * Filtra la URL base de la API de Postali.
		 *
		 * @param string $url URL sin barra final.
		 */
		return untrailingslashit( (string) apply_filters( 'postali_cp_api_base', 'https://postali.app' ) );
	}

	/**
	 * ¿Es un CP mexicano con formato válido (5 dígitos)?
	 *
	 * @param string $cp Código postal.
	 * @return bool
	 */
	public static function is_valid_format( $cp ) {
		return 1 === preg_match( '/^\d{5}$/', (string) $cp );
	}

	/**
	 * Normaliza lo que escribe el cliente: quita espacios y guiones.
	 *
	 * @param string $cp Código postal tal como llegó.
	 * @return string
	 */
	public static function normalize( $cp ) {
		return (string) preg_replace( '/[\s\-]+/', '', (string) $cp );
	}

	/**
	 * Busca un CP.
	 *
	 * @param string $cp Código postal de 5 dígitos.
	 * @return array{status:string,data:array|null}
	 */
	public static function lookup( $cp ) {
		$cp = self::normalize( $cp );
		if ( ! self::is_valid_format( $cp ) ) {
			return array(
				'status' => self::NOT_FOUND,
				'data'   => null,
			);
		}

		$cache_key = 'postali_cp_mx_' . $cp;
		$cached    = get_transient( $cache_key );
		if ( is_array( $cached ) && isset( $cached['status'] ) ) {
			return $cached;
		}

		$response = wp_remote_get(
			self::base_url() . '/api/v1/mx/cp/' . rawurlencode( $cp ),
			array(
				'timeout'    => 4,
				'headers'    => array( 'Accept' => 'application/json' ),
				'user-agent' => 'postali-codigos-postales/' . POSTALI_CP_VERSION,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array(
				'status' => self::UNAVAILABLE,
				'data'   => null,
			);
		}

		$code = (int) wp_remote_retrieve_response_code( $response );
		$body = json_decode( (string) wp_remote_retrieve_body( $response ), true );

		if ( 200 === $code && is_array( $body ) && isset( $body['estado'], $body['municipio'] ) ) {
			$result = array(
				'status' => self::FOUND,
				'data'   => $body,
			);
			set_transient( $cache_key, $result, WEEK_IN_SECONDS );
			return $result;
		}

		if ( ( 404 === $code || 400 === $code ) && is_array( $body ) && isset( $body['error']['code'] ) ) {
			$result = array(
				'status' => self::NOT_FOUND,
				'data'   => null,
			);
			set_transient( $cache_key, $result, DAY_IN_SECONDS );
			return $result;
		}

		// 429, 5xx, respuestas inesperadas: no cachear, no bloquear.
		return array(
			'status' => self::UNAVAILABLE,
			'data'   => null,
		);
	}
}
