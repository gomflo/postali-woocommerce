// Pruebas del núcleo JS (mapeo de estados, colonias, cliente HTTP con caché).
// Ejecutar: node --test tests/js
// Pruebas contra la API real (opcionales): POSTALI_LIVE=1 node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname( fileURLToPath( import.meta.url ) );
const root = path.resolve( here, '..', '..' );
const plugin = path.join( root, 'postali-codigos-postales' );
const require = createRequire( import.meta.url );
const core = require( path.join( plugin, 'assets/js/postali-core.js' ) );
const fixture = ( name ) => JSON.parse( readFileSync( path.join( root, 'tests/fixtures', name ), 'utf8' ) );

// Códigos de estado MX tal como están en woocommerce/i18n/states.php (WooCommerce 11.1).
const WC_MX_STATES = {
	DF: 'Ciudad de México', JA: 'Jalisco', NL: 'Nuevo León', AG: 'Aguascalientes',
	BC: 'Baja California', BS: 'Baja California Sur', CM: 'Campeche', CS: 'Chiapas',
	CH: 'Chihuahua', CO: 'Coahuila', CL: 'Colima', DG: 'Durango', GT: 'Guanajuato',
	GR: 'Guerrero', HG: 'Hidalgo', MX: 'Estado de México', MI: 'Michoacán', MO: 'Morelos',
	NA: 'Nayarit', OA: 'Oaxaca', PU: 'Puebla', QT: 'Querétaro', QR: 'Quintana Roo',
	SL: 'San Luis Potosí', SI: 'Sinaloa', SO: 'Sonora', TB: 'Tabasco', TM: 'Tamaulipas',
	TL: 'Tlaxcala', VE: 'Veracruz', YU: 'Yucatán', ZA: 'Zacatecas',
};

test( 'el mapa cubre los 32 estados de WooCommerce, sin repetir', () => {
	const codes = Object.values( core.STATE_MAP );
	assert.equal( codes.length, 32 );
	assert.equal( new Set( codes ).size, 32 );
	assert.deepEqual( [ ...codes ].sort(), Object.keys( WC_MX_STATES ).sort() );
} );

test( 'si hay WooCommerce descargado (WC_STATES_PHP), coincide con su i18n/states.php', ( t ) => {
	const file = process.env.WC_STATES_PHP;
	if ( ! file ) {
		t.skip( 'WC_STATES_PHP no definido' );
		return;
	}
	const src = readFileSync( file, 'utf8' );
	const block = src.slice( src.indexOf( "'MX' => array(" ), src.indexOf( "'MY' => array(" ) );
	const codes = [ ...block.matchAll( /'([A-Z]{2})'\s*=>\s*__\(/g ) ].map( ( m ) => m[ 1 ] );
	assert.deepEqual( codes.sort(), Object.values( core.STATE_MAP ).sort() );
} );

test( 'el mapa JS es idéntico al de PHP (class-postali-states.php)', () => {
	const php = readFileSync( path.join( plugin, 'includes/class-postali-states.php' ), 'utf8' );
	const section = ( name ) => {
		const start = php.indexOf( `const ${ name } = array(` );
		const end = php.indexOf( ');', start );
		return Object.fromEntries(
			[ ...php.slice( start, end ).matchAll( /'([a-z-]+)'\s*=>\s*'([a-zA-Z-]+)'/g ) ].map( ( m ) => [ m[ 1 ], m[ 2 ] ] )
		);
	};
	assert.deepEqual( section( 'MAP' ), core.STATE_MAP );
	assert.deepEqual( section( 'NAME_ALIASES' ), core.NAME_ALIASES );
} );

test( 'cada estado de Postali (/api/v1/mx/estados) se mapea, por slug y por nombre', () => {
	const { estados } = fixture( 'estados.json' );
	assert.equal( estados.length, 32 );
	const seen = new Set();
	for ( const e of estados ) {
		const bySlug = core.stateCode( { estado_slug: e.slug, estado: e.nombre } );
		const byName = core.stateCode( { estado: e.nombre } );
		assert.ok( bySlug, `sin código para slug ${ e.slug }` );
		assert.equal( byName, bySlug, `el nombre "${ e.nombre }" no da el mismo código que el slug` );
		seen.add( bySlug );
	}
	assert.equal( seen.size, 32 );
} );

test( 'casos que no son obvios: CDMX = DF, Estado de México = MX', () => {
	assert.equal( core.stateCode( fixture( 'cp-06700.json' ) ), 'DF' );
	assert.equal( core.stateCode( { estado: 'México' } ), 'MX' );
	assert.equal( core.stateCode( { estado: 'Distrito Federal' } ), 'DF' );
	assert.equal( core.stateCode( { estado: 'Veracruz de Ignacio de la Llave' } ), 'VE' );
	assert.equal( core.stateCode( { estado: 'Coahuila de Zaragoza' } ), 'CO' );
	assert.equal( core.stateCode( { estado: 'Michoacán de Ocampo' } ), 'MI' );
	assert.equal( core.stateCode( fixture( 'cp-76148.json' ) ), 'QT' );
	assert.equal( core.stateCode( { estado: 'Atlántida' } ), '' );
	assert.equal( core.stateCode( null ), '' );
} );

test( 'normalizeCp', () => {
	assert.equal( core.normalizeCp( '06700' ), '06700' );
	assert.equal( core.normalizeCp( ' 06 700 ' ), '06700' );
	assert.equal( core.normalizeCp( '06-700' ), '06700' );
	assert.equal( core.normalizeCp( '6700' ), null );
	assert.equal( core.normalizeCp( '067000' ), null );
	assert.equal( core.normalizeCp( 'abcde' ), null );
	assert.equal( core.normalizeCp( undefined ), null );
} );

test( 'coloniaOptions: ordena, quita duplicados y marca el tipo cuando no es "Colonia"', () => {
	const opts = core.coloniaOptions( fixture( 'cp-76148.json' ) );
	assert.equal( opts.length, 61 );
	const values = opts.map( ( o ) => o.value );
	assert.deepEqual( values, [ ...values ].sort( ( a, b ) => a.localeCompare( b, 'es', { sensitivity: 'base' } ) ) );
	assert.equal( opts.find( ( o ) => o.value === 'Belén' ).label, 'Belén (Fraccionamiento)' );
	assert.equal( opts.find( ( o ) => o.value === 'Cuesta Azul' ).label, 'Cuesta Azul' );

	const dup = core.coloniaOptions( { asentamientos: [
		{ nombre: 'Centro', tipo: 'Colonia' }, { nombre: 'centro', tipo: 'Barrio' }, { nombre: '' }, null,
	] } );
	assert.deepEqual( dup.map( ( o ) => o.value ), [ 'Centro' ] );
	assert.deepEqual( core.coloniaOptions( {} ), [] );
} );

test( 'cityFor: municipio por defecto; ciudad SEPOMEX con respaldo', () => {
	const roma = fixture( 'cp-06700.json' );
	assert.equal( core.cityFor( roma, 'municipio' ), 'Cuauhtémoc' );
	assert.equal( core.cityFor( roma, 'ciudad', 'Roma Norte' ), 'Ciudad de México' );
	// 20900 (Jesús María, Ags.): SEPOMEX no trae ciudad → municipio.
	assert.equal( core.cityFor( fixture( 'cp-20900.json' ), 'ciudad' ), 'Jesús María' );
	assert.equal( core.cityFor( null, 'municipio' ), '' );
} );

// ---------- Cliente HTTP ----------

function fakeResponse( status, body ) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: () => ( body === undefined ? Promise.reject( new Error( 'no json' ) ) : Promise.resolve( body ) ),
	};
}

function memoryStorage() {
	const m = new Map();
	return { getItem: ( k ) => ( m.has( k ) ? m.get( k ) : null ), setItem: ( k, v ) => m.set( k, String( v ) ), m };
}

test( 'cliente: encontrado, cachea y deduplica peticiones en vuelo', async () => {
	const calls = [];
	const client = core.createClient( {
		apiBase: 'https://postali.app/',
		storage: null,
		fetch: ( url ) => {
			calls.push( url );
			return Promise.resolve( fakeResponse( 200, fixture( 'cp-06700.json' ) ) );
		},
	} );
	const [ a, b ] = await Promise.all( [ client.lookup( '06700' ), client.lookup( '06 700' ) ] );
	assert.equal( a.status, 'found' );
	assert.equal( b, a );
	assert.equal( ( await client.lookup( '06700' ) ).data.municipio, 'Cuauhtémoc' );
	assert.deepEqual( calls, [ 'https://postali.app/api/v1/mx/cp/06700' ] );
} );

test( 'cliente: 404 y 400 con error estilo Stripe → not_found (y se cachea)', async () => {
	let n = 0;
	const client = core.createClient( {
		storage: null,
		fetch: () => {
			n++;
			return Promise.resolve( fakeResponse( 404, fixture( 'cp-00000.json' ) ) );
		},
	} );
	const r = await client.lookup( '00000' );
	assert.deepEqual( r, { status: 'not_found', code: 'not_found' } );
	await client.lookup( '00000' );
	assert.equal( n, 1 );

	const bad = core.createClient( { storage: null, fetch: () => Promise.resolve( fakeResponse( 400, { error: { code: 'invalid_cp' } } ) ) } );
	assert.equal( ( await bad.lookup( '12345' ) ).status, 'not_found' );
} );

test( 'cliente: CP con formato inválido no hace petición', async () => {
	const client = core.createClient( { storage: null, fetch: () => assert.fail( 'no debía llamar' ) } );
	assert.equal( ( await client.lookup( '123' ) ).status, 'not_found' );
} );

test( 'cliente: fallas de red, 5xx, 429 y JSON roto → error, sin cachear, sin lanzar', async () => {
	let n = 0;
	const responses = [
		() => Promise.reject( new TypeError( 'Failed to fetch' ) ),
		() => Promise.resolve( fakeResponse( 503, { error: { code: 'unavailable' } } ) ),
		() => Promise.resolve( fakeResponse( 429, { error: { code: 'rate_limited' } } ) ),
		() => Promise.resolve( fakeResponse( 200, undefined ) ),
		() => Promise.resolve( fakeResponse( 200, { unexpected: true } ) ),
		() => Promise.resolve( fakeResponse( 200, fixture( 'cp-06700.json' ) ) ),
	];
	const client = core.createClient( { storage: null, fetch: () => responses[ n++ ]() } );
	for ( let i = 0; i < 5; i++ ) {
		assert.equal( ( await client.lookup( '06700' ) ).status, 'error', `respuesta ${ i }` );
	}
	assert.equal( ( await client.lookup( '06700' ) ).status, 'found' );
	assert.equal( n, 6 );
} );

test( 'cliente: timeout aborta y resuelve como error', async () => {
	const client = core.createClient( {
		storage: null,
		timeoutMs: 20,
		fetch: ( url, init ) => new Promise( ( resolve, reject ) => {
			init.signal.addEventListener( 'abort', () => reject( new Error( 'aborted' ) ) );
		} ),
	} );
	assert.equal( ( await client.lookup( '06700' ) ).status, 'error' );
} );

test( 'cliente: usa sessionStorage entre instancias y tolera storage que lanza', async () => {
	const storage = memoryStorage();
	let n = 0;
	const fetch = () => {
		n++;
		return Promise.resolve( fakeResponse( 200, fixture( 'cp-06700.json' ) ) );
	};
	await core.createClient( { storage, fetch } ).lookup( '06700' );
	const r = await core.createClient( { storage, fetch } ).lookup( '06700' );
	assert.equal( r.status, 'found' );
	assert.equal( n, 1 );

	const throwing = { getItem() { throw new Error( 'SecurityError' ); }, setItem() { throw new Error( 'QuotaExceeded' ); } };
	assert.equal( ( await core.createClient( { storage: throwing, fetch } ).lookup( '06700' ) ).status, 'found' );
} );

// ---------- Contra la API real (opcional) ----------

const live = process.env.POSTALI_LIVE ? test : test.skip;

live( 'API real: 06700, 76148, 00000 y los 32 estados', async () => {
	const client = core.createClient( { storage: null } );
	const roma = await client.lookup( '06700' );
	assert.equal( roma.status, 'found' );
	assert.equal( core.stateCode( roma.data ), 'DF' );
	const qro = await client.lookup( '76148' );
	assert.equal( core.stateCode( qro.data ), 'QT' );
	assert.ok( core.coloniaOptions( qro.data ).length > 10 );
	assert.equal( ( await client.lookup( '00000' ) ).status, 'not_found' );

	const res = await fetch( 'https://postali.app/api/v1/mx/estados' );
	const { estados } = await res.json();
	for ( const e of estados ) {
		assert.ok( core.stateCode( { estado_slug: e.slug } ), e.slug );
	}
} );
