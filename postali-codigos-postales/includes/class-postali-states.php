<?php
/**
 * Mapeo de estados de Postali (SEPOMEX) a los códigos de estado de WooCommerce.
 *
 * WooCommerce define los estados de México en i18n/states.php. Ojo con dos
 * casos que no son obvios:
 *   - Ciudad de México usa el código histórico "DF", no "CMX".
 *   - Estado de México usa "MX" (igual que el código de país).
 *
 * Postali devuelve el nombre oficial de SEPOMEX ("Coahuila de Zaragoza",
 * "Michoacán de Ocampo", "Veracruz de Ignacio de la Llave", "México") y un
 * slug estable. Se mapea por slug; el nombre sólo es respaldo.
 *
 * Esta tabla está duplicada en assets/js/postali-core.js. Las pruebas en
 * tests/js comprueban que ambas coinciden.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Tabla estado_slug de Postali → código WooCommerce.
 */
final class Postali_States {

	/**
	 * Slug de Postali (estado_slug) → código de estado de WooCommerce.
	 *
	 * @var array<string,string>
	 */
	const MAP = array(
		'aguascalientes'      => 'AG',
		'baja-california'     => 'BC',
		'baja-california-sur' => 'BS',
		'campeche'            => 'CM',
		'chiapas'             => 'CS',
		'chihuahua'           => 'CH',
		'ciudad-de-mexico'    => 'DF',
		'coahuila'            => 'CO',
		'colima'              => 'CL',
		'durango'             => 'DG',
		'guanajuato'          => 'GT',
		'guerrero'            => 'GR',
		'hidalgo'             => 'HG',
		'jalisco'             => 'JA',
		'michoacan'           => 'MI',
		'morelos'             => 'MO',
		'estado-de-mexico'    => 'MX',
		'nayarit'             => 'NA',
		'nuevo-leon'          => 'NL',
		'oaxaca'              => 'OA',
		'puebla'              => 'PU',
		'queretaro'           => 'QT',
		'quintana-roo'        => 'QR',
		'san-luis-potosi'     => 'SL',
		'sinaloa'             => 'SI',
		'sonora'              => 'SO',
		'tabasco'             => 'TB',
		'tamaulipas'          => 'TM',
		'tlaxcala'            => 'TL',
		'veracruz'            => 'VE',
		'yucatan'             => 'YU',
		'zacatecas'           => 'ZA',
	);

	/**
	 * Nombres oficiales de SEPOMEX que no coinciden con el slug al normalizarlos.
	 *
	 * @var array<string,string>
	 */
	const NAME_ALIASES = array(
		'coahuila-de-zaragoza'            => 'coahuila',
		'michoacan-de-ocampo'             => 'michoacan',
		'veracruz-de-ignacio-de-la-llave' => 'veracruz',
		'mexico'                          => 'estado-de-mexico',
		'distrito-federal'                => 'ciudad-de-mexico',
		'cdmx'                            => 'ciudad-de-mexico',
	);

	/**
	 * Devuelve el código WooCommerce para una respuesta de Postali, o '' si no se reconoce.
	 *
	 * @param array $data Respuesta decodificada de /api/v1/mx/cp/{cp}.
	 * @return string
	 */
	public static function code_from_response( $data ) {
		if ( ! is_array( $data ) ) {
			return '';
		}
		if ( ! empty( $data['estado_slug'] ) && isset( self::MAP[ $data['estado_slug'] ] ) ) {
			return self::MAP[ $data['estado_slug'] ];
		}
		if ( ! empty( $data['estado'] ) ) {
			$slug = sanitize_title( remove_accents( (string) $data['estado'] ) );
			if ( isset( self::NAME_ALIASES[ $slug ] ) ) {
				$slug = self::NAME_ALIASES[ $slug ];
			}
			if ( isset( self::MAP[ $slug ] ) ) {
				return self::MAP[ $slug ];
			}
		}
		return '';
	}
}
