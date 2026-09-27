<?php
// Datos de prueba para WordPress Playground (tienda MX, producto, zona de envío,
// página con checkout clásico). Lo ejecuta tests/e2e/blueprint.json.
require_once '/wordpress/wp-load.php';

update_option( 'woocommerce_default_country', 'MX:DF' );
update_option( 'woocommerce_currency', 'MXN' );
update_option( 'woocommerce_coming_soon', 'no' );
update_option( 'woocommerce_onboarding_profile', array( 'skipped' => true ) );
update_option( 'woocommerce_enable_guest_checkout', 'yes' );
update_option( 'woocommerce_cod_settings', array( 'enabled' => 'yes', 'title' => 'Pago contra entrega' ) );

// Zona de envío México con envío gratis.
if ( ! get_option( 'postali_test_zone' ) ) {
	$zone = new WC_Shipping_Zone();
	$zone->set_zone_name( 'México' );
	$zone->add_location( 'MX', 'country' );
	$zone->save();
	$zone->add_shipping_method( 'free_shipping' );
	update_option( 'postali_test_zone', $zone->get_id() );
}

if ( ! get_option( 'postali_test_product' ) ) {
	$p = new WC_Product_Simple();
	$p->set_name( 'Taza Postali' );
	$p->set_regular_price( '100' );
	$p->set_status( 'publish' );
	$p->save();
	update_option( 'postali_test_product', $p->get_id() );
}

if ( ! get_option( 'postali_test_classic_page' ) ) {
	$id = wp_insert_post( array(
		'post_title'   => 'Checkout clasico',
		'post_name'    => 'checkout-clasico',
		'post_status'  => 'publish',
		'post_type'    => 'page',
		'post_content' => '<!-- wp:shortcode -->[woocommerce_checkout]<!-- /wp:shortcode -->',
	) );
	update_option( 'postali_test_classic_page', $id );
}

$checkout = get_post( wc_get_page_id( 'checkout' ) );
echo 'checkout page: ' . ( $checkout ? $checkout->post_name . ' blocks=' . ( has_block( 'woocommerce/checkout', $checkout ) ? 'yes' : 'no' ) : 'none' ) . "\n";
echo 'product: ' . get_option( 'postali_test_product' ) . "\n";
