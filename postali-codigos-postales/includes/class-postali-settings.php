<?php
/**
 * Pestaña WooCommerce > Ajustes > Postali.
 *
 * WC_Settings_Page se encarga del formulario, del nonce (woocommerce-settings),
 * de la comprobación de permisos (manage_woocommerce) y de sanitizar cada
 * opción según su tipo (checkbox → yes/no, select → sólo valores permitidos).
 *
 * @package Postali_Codigos_Postales
 */

defined( 'ABSPATH' ) || exit;

/**
 * Página de ajustes del plugin.
 */
class Postali_Settings extends WC_Settings_Page {

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->id    = 'postali';
		$this->label = __( 'Postali', 'postali-codigos-postales' );
		parent::__construct();
	}

	/**
	 * Ajustes de la sección por defecto.
	 *
	 * @return array
	 */
	protected function get_settings_for_default_section() {
		return array(
			array(
				'title' => __( 'Códigos postales de México', 'postali-codigos-postales' ),
				'type'  => 'title',
				'desc'  => __( 'Cuando el cliente escribe un código postal de 5 dígitos con país México, se consultan el estado, el municipio y las colonias en la API pública de Postali (datos de SEPOMEX). Si la consulta falla, el cliente sigue pudiendo llenar la dirección a mano.', 'postali-codigos-postales' ),
				'id'    => 'postali_cp_section',
			),
			array(
				'title'   => __( 'Autocompletado', 'postali-codigos-postales' ),
				'desc'    => __( 'Activar el autocompletado por código postal en el checkout', 'postali-codigos-postales' ),
				'id'      => 'postali_cp_enabled',
				'type'    => 'checkbox',
				'default' => Postali_Options::DEFAULTS['postali_cp_enabled'],
			),
			array(
				'title'         => __( 'Campos a llenar', 'postali-codigos-postales' ),
				'desc'          => __( 'Estado', 'postali-codigos-postales' ),
				'id'            => 'postali_cp_fill_state',
				'type'          => 'checkbox',
				'default'       => Postali_Options::DEFAULTS['postali_cp_fill_state'],
				'checkboxgroup' => 'start',
			),
			array(
				'desc'          => __( 'Ciudad (municipio o alcaldía)', 'postali-codigos-postales' ),
				'id'            => 'postali_cp_fill_city',
				'type'          => 'checkbox',
				'default'       => Postali_Options::DEFAULTS['postali_cp_fill_city'],
				'checkboxgroup' => '',
			),
			array(
				'desc'          => __( 'Colonia (lista desplegable con las colonias del código postal)', 'postali-codigos-postales' ),
				'id'            => 'postali_cp_fill_colonia',
				'type'          => 'checkbox',
				'default'       => Postali_Options::DEFAULTS['postali_cp_fill_colonia'],
				'checkboxgroup' => 'end',
			),
			array(
				'title'    => __( 'Qué poner en "Ciudad"', 'postali-codigos-postales' ),
				'id'       => 'postali_cp_city_source',
				'type'     => 'select',
				'class'    => 'wc-enhanced-select',
				'default'  => Postali_Options::DEFAULTS['postali_cp_city_source'],
				'options'  => array(
					'municipio' => __( 'Municipio o alcaldía (p. ej. "Cuauhtémoc")', 'postali-codigos-postales' ),
					'ciudad'    => __( 'Ciudad de SEPOMEX si existe (p. ej. "Ciudad de México"); si no, el municipio', 'postali-codigos-postales' ),
				),
				'desc_tip' => __( 'Las paqueterías mexicanas suelen pedir el municipio. La ciudad de SEPOMEX no existe en zonas rurales; en ese caso se usa el municipio.', 'postali-codigos-postales' ),
			),
			array(
				'title'    => __( 'Dónde guardar la colonia', 'postali-codigos-postales' ),
				'id'       => 'postali_cp_colonia_field',
				'type'     => 'radio',
				'default'  => Postali_Options::DEFAULTS['postali_cp_colonia_field'],
				'options'  => array(
					'address_2' => __( 'En "Dirección línea 2" (recomendado: aparece en correos, etiquetas de envío y exportaciones sin configurar nada)', 'postali-codigos-postales' ),
					'dedicated' => __( 'En un campo propio "Colonia" (guardado como campo adicional del pedido)', 'postali-codigos-postales' ),
				),
				'desc_tip' => __( 'Con la opción recomendada, "Dirección línea 1" queda para calle y número, y "Dirección línea 2" para la colonia, que es la convención más común en tiendas mexicanas.', 'postali-codigos-postales' ),
			),
			array(
				'title'   => __( 'Orden de los campos', 'postali-codigos-postales' ),
				'desc'    => __( 'Para México, mostrar el código postal antes de la calle y la colonia', 'postali-codigos-postales' ),
				'id'      => 'postali_cp_postcode_first',
				'type'    => 'checkbox',
				'default' => Postali_Options::DEFAULTS['postali_cp_postcode_first'],
			),
			array(
				'title'    => __( 'Validación en el servidor', 'postali-codigos-postales' ),
				'desc'     => __( 'Al confirmar el pedido, rechazar códigos postales que no existen o que no corresponden al estado elegido', 'postali-codigos-postales' ),
				'id'       => 'postali_cp_server_validation',
				'type'     => 'checkbox',
				'default'  => Postali_Options::DEFAULTS['postali_cp_server_validation'],
				'desc_tip' => __( 'Consulta la API desde tu servidor (con caché de una semana). Si la API no responde, el pedido se acepta igual.', 'postali-codigos-postales' ),
			),
			array(
				'title'    => __( 'Crédito', 'postali-codigos-postales' ),
				'desc'     => __( 'Mostrar un enlace pequeño "Datos: Postali" (a postali.app) debajo del campo de colonia en el checkout', 'postali-codigos-postales' ),
				'id'       => 'postali_cp_attribution',
				'type'     => 'checkbox',
				'default'  => Postali_Options::DEFAULTS['postali_cp_attribution'],
				'desc_tip' => __( 'Opcional y desactivado por defecto. El plugin funciona igual sin él.', 'postali-codigos-postales' ),
			),
			array(
				'type' => 'sectionend',
				'id'   => 'postali_cp_section',
			),
		);
	}
}
