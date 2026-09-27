<?php
/**
 * Limpieza al desinstalar: borra los ajustes y la caché de consultas.
 *
 * Las colonias ya guardadas en pedidos y clientes NO se borran: son datos de
 * la tienda, no del plugin.
 *
 * @package Postali_Codigos_Postales
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$postali_cp_options = array(
	'postali_cp_enabled',
	'postali_cp_fill_state',
	'postali_cp_fill_city',
	'postali_cp_city_source',
	'postali_cp_fill_colonia',
	'postali_cp_colonia_field',
	'postali_cp_postcode_first',
	'postali_cp_server_validation',
	'postali_cp_attribution',
);

foreach ( $postali_cp_options as $postali_cp_option ) {
	delete_option( $postali_cp_option );
}

global $wpdb;
// Transients "postali_cp_mx_{cp}" de la validación en servidor.
// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
		$wpdb->esc_like( '_transient_postali_cp_mx_' ) . '%',
		$wpdb->esc_like( '_transient_timeout_postali_cp_mx_' ) . '%'
	)
);
