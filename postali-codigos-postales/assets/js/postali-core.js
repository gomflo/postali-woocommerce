/**
 * Postali — núcleo sin dependencias: mapeo de estados, armado de opciones de
 * colonia y cliente HTTP con caché. Lo usan postali-classic.js y
 * postali-blocks.js, y se prueba en Node (tests/js).
 *
 * @package Postali_Codigos_Postales
 * @license GPL-2.0-or-later
 */
( function ( root, factory ) {
	'use strict';
	if ( typeof module === 'object' && module.exports ) {
		module.exports = factory();
	} else {
		root.PostaliCore = factory();
	}
}( typeof self !== 'undefined' ? self : this, function () {
	'use strict';

	/**
	 * estado_slug de Postali → código de estado de WooCommerce (i18n/states.php).
	 * Ojo: Ciudad de México es "DF" y Estado de México es "MX".
	 * Debe coincidir con includes/class-postali-states.php (lo revisan las pruebas).
	 */
	var STATE_MAP = {
		'aguascalientes': 'AG',
		'baja-california': 'BC',
		'baja-california-sur': 'BS',
		'campeche': 'CM',
		'chiapas': 'CS',
		'chihuahua': 'CH',
		'ciudad-de-mexico': 'DF',
		'coahuila': 'CO',
		'colima': 'CL',
		'durango': 'DG',
		'guanajuato': 'GT',
		'guerrero': 'GR',
		'hidalgo': 'HG',
		'jalisco': 'JA',
		'michoacan': 'MI',
		'morelos': 'MO',
		'estado-de-mexico': 'MX',
		'nayarit': 'NA',
		'nuevo-leon': 'NL',
		'oaxaca': 'OA',
		'puebla': 'PU',
		'queretaro': 'QT',
		'quintana-roo': 'QR',
		'san-luis-potosi': 'SL',
		'sinaloa': 'SI',
		'sonora': 'SO',
		'tabasco': 'TB',
		'tamaulipas': 'TM',
		'tlaxcala': 'TL',
		'veracruz': 'VE',
		'yucatan': 'YU',
		'zacatecas': 'ZA'
	};

	var NAME_ALIASES = {
		'coahuila-de-zaragoza': 'coahuila',
		'michoacan-de-ocampo': 'michoacan',
		'veracruz-de-ignacio-de-la-llave': 'veracruz',
		'mexico': 'estado-de-mexico',
		'distrito-federal': 'ciudad-de-mexico',
		'cdmx': 'ciudad-de-mexico'
	};

	function slugify( str ) {
		return String( str || '' )
			.normalize( 'NFD' )
			.replace( /[̀-ͯ]/g, '' )
			.toLowerCase()
			.replace( /[^a-z0-9]+/g, '-' )
			.replace( /^-+|-+$/g, '' );
	}

	/** "06 700", "06-700" → "06700". Devuelve null si no son 5 dígitos. */
	function normalizeCp( value ) {
		var s = String( value == null ? '' : value ).replace( /[\s-]+/g, '' );
		return /^\d{5}$/.test( s ) ? s : null;
	}

	/** Código WooCommerce del estado de una respuesta de Postali, o '' si no se reconoce. */
	function stateCode( data ) {
		if ( ! data ) {
			return '';
		}
		if ( data.estado_slug && Object.prototype.hasOwnProperty.call( STATE_MAP, data.estado_slug ) ) {
			return STATE_MAP[ data.estado_slug ];
		}
		var slug = slugify( data.estado );
		if ( Object.prototype.hasOwnProperty.call( NAME_ALIASES, slug ) ) {
			slug = NAME_ALIASES[ slug ];
		}
		return Object.prototype.hasOwnProperty.call( STATE_MAP, slug ) ? STATE_MAP[ slug ] : '';
	}

	/**
	 * Lista de colonias para el select: sin duplicados por nombre, ordenada.
	 * Se indica el tipo cuando no es "Colonia" (Fraccionamiento, Barrio, Ejido…).
	 */
	function coloniaOptions( data ) {
		var list = ( data && Array.isArray( data.asentamientos ) ) ? data.asentamientos : [];
		var seen = Object.create( null );
		var out = [];
		list.forEach( function ( a ) {
			if ( ! a || ! a.nombre ) {
				return;
			}
			var key = a.nombre.toLowerCase();
			if ( seen[ key ] ) {
				return;
			}
			seen[ key ] = true;
			var tipo = a.tipo && a.tipo !== 'Colonia' ? a.tipo : '';
			out.push( {
				value: a.nombre,
				label: tipo ? a.nombre + ' (' + tipo + ')' : a.nombre,
				ciudad: a.ciudad || ''
			} );
		} );
		out.sort( function ( x, y ) {
			return x.value.localeCompare( y.value, 'es', { sensitivity: 'base' } );
		} );
		return out;
	}

	/**
	 * Valor para el campo "Ciudad".
	 *  - source "municipio": el municipio/alcaldía.
	 *  - source "ciudad": la ciudad SEPOMEX de la colonia elegida (o la primera
	 *    que tenga), con el municipio como respaldo en zonas rurales.
	 */
	function cityFor( data, source, coloniaName ) {
		if ( ! data ) {
			return '';
		}
		if ( source === 'ciudad' ) {
			var list = Array.isArray( data.asentamientos ) ? data.asentamientos : [];
			var match = null;
			if ( coloniaName ) {
				match = list.filter( function ( a ) {
					return a && a.nombre === coloniaName && a.ciudad;
				} )[ 0 ];
			}
			if ( ! match ) {
				match = list.filter( function ( a ) {
					return a && a.ciudad;
				} )[ 0 ];
			}
			if ( match ) {
				return match.ciudad;
			}
		}
		return data.municipio || '';
	}

	/**
	 * Cliente con caché en memoria + sessionStorage y deduplicación de
	 * peticiones en vuelo. Nunca lanza: resuelve siempre con
	 * { status: 'found', data } | { status: 'not_found' } | { status: 'error' }.
	 */
	function createClient( opts ) {
		opts = opts || {};
		var base = String( opts.apiBase || 'https://postali.app' ).replace( /\/+$/, '' );
		var fetchImpl = opts.fetch || ( typeof fetch !== 'undefined' ? fetch.bind( null ) : null );
		var storage = opts.storage === undefined ? safeSessionStorage() : opts.storage;
		var timeoutMs = opts.timeoutMs || 5000;
		var memory = Object.create( null );
		var inflight = Object.create( null );

		function readStorage( cp ) {
			if ( ! storage ) {
				return null;
			}
			try {
				var raw = storage.getItem( 'postali:mx:' + cp );
				return raw ? JSON.parse( raw ) : null;
			} catch ( e ) {
				return null;
			}
		}

		function writeStorage( cp, result ) {
			if ( ! storage ) {
				return;
			}
			try {
				storage.setItem( 'postali:mx:' + cp, JSON.stringify( result ) );
			} catch ( e ) {
				// Cuota llena o modo privado: la caché en memoria basta.
			}
		}

		function lookup( rawCp ) {
			var cp = normalizeCp( rawCp );
			if ( ! cp ) {
				return Promise.resolve( { status: 'not_found' } );
			}
			if ( memory[ cp ] ) {
				return Promise.resolve( memory[ cp ] );
			}
			var stored = readStorage( cp );
			if ( stored && stored.status ) {
				memory[ cp ] = stored;
				return Promise.resolve( stored );
			}
			if ( inflight[ cp ] ) {
				return inflight[ cp ];
			}
			if ( ! fetchImpl ) {
				return Promise.resolve( { status: 'error' } );
			}

			var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
			var timer = controller ? setTimeout( function () {
				controller.abort();
			}, timeoutMs ) : null;

			var p = fetchImpl( base + '/api/v1/mx/cp/' + encodeURIComponent( cp ), {
				headers: { Accept: 'application/json' },
				credentials: 'omit',
				signal: controller ? controller.signal : undefined
			} )
				.then( function ( res ) {
					return res.json().then( function ( body ) {
						return { ok: res.ok, status: res.status, body: body };
					}, function () {
						return { ok: false, status: res.status, body: null };
					} );
				} )
				.then( function ( r ) {
					var result;
					if ( r.ok && r.body && r.body.estado && Array.isArray( r.body.asentamientos ) ) {
						result = { status: 'found', data: r.body };
					} else if ( ( r.status === 404 || r.status === 400 ) && r.body && r.body.error ) {
						result = { status: 'not_found', code: r.body.error.code || '' };
					} else {
						return { status: 'error' };
					}
					memory[ cp ] = result;
					writeStorage( cp, result );
					return result;
				} )
				.catch( function () {
					return { status: 'error' };
				} )
				.then( function ( result ) {
					if ( timer ) {
						clearTimeout( timer );
					}
					delete inflight[ cp ];
					return result;
				} );

			inflight[ cp ] = p;
			return p;
		}

		return { lookup: lookup };
	}

	var OTHER = '__postali_other__';

	/**
	 * Select de colonias (DOM puro, lo comparten el checkout clásico y el de bloques).
	 *
	 * @param {Document} doc
	 * @param {Object}   o  { id, options, current, i18n, showLabel, blocksMarkup, attribution, creditUrl, onChoose(value, isOther) }
	 * @return {{ el: HTMLElement, select: HTMLSelectElement }}
	 */
	function createPicker( doc, o ) {
		var i18n = o.i18n || {};
		var wrap = doc.createElement( 'div' );
		wrap.className = 'postali-cp-picker';

		var select = doc.createElement( 'select' );
		select.id = o.id;
		select.className = 'postali-cp-select';
		var parent = wrap;

		if ( o.blocksMarkup ) {
			// Mismo marcado que los <select> del checkout de bloques
			// (estado, país), para heredar sus estilos.
			var outer = doc.createElement( 'div' );
			outer.className = 'wc-blocks-components-select';
			var box = doc.createElement( 'div' );
			box.className = 'wc-blocks-components-select__container';
			var blabel = doc.createElement( 'label' );
			blabel.className = 'wc-blocks-components-select__label';
			blabel.htmlFor = o.id;
			blabel.textContent = i18n.colonia || 'Colonia';
			select.className += ' wc-blocks-components-select__select';
			box.appendChild( blabel );
			box.appendChild( select );
			var svgNs = 'http://www.w3.org/2000/svg';
			var svg = doc.createElementNS( svgNs, 'svg' );
			svg.setAttribute( 'viewBox', '0 0 24 24' );
			svg.setAttribute( 'width', '24' );
			svg.setAttribute( 'height', '24' );
			svg.setAttribute( 'class', 'wc-blocks-components-select__expand' );
			svg.setAttribute( 'aria-hidden', 'true' );
			svg.setAttribute( 'focusable', 'false' );
			var path = doc.createElementNS( svgNs, 'path' );
			path.setAttribute( 'd', 'M17.5 11.6L12 16l-5.5-4.4.9-1.2L12 14l4.5-3.6 1 1.2z' );
			svg.appendChild( path );
			box.appendChild( svg );
			outer.appendChild( box );
			wrap.appendChild( outer );
			parent = box;
		} else if ( o.showLabel ) {
			var label = doc.createElement( 'label' );
			label.className = 'postali-cp-label';
			label.htmlFor = o.id;
			label.textContent = i18n.colonia || 'Colonia';
			wrap.appendChild( label );
		} else {
			select.setAttribute( 'aria-label', i18n.colonia || 'Colonia' );
		}

		function addOption( value, text ) {
			var opt = doc.createElement( 'option' );
			opt.value = value;
			opt.textContent = text;
			select.appendChild( opt );
			return opt;
		}

		addOption( '', i18n.choose || '' );
		( o.options || [] ).forEach( function ( item ) {
			addOption( item.value, item.label );
		} );
		addOption( OTHER, i18n.other || '' );

		var current = o.current || '';
		var known = ( o.options || [] ).some( function ( item ) {
			return item.value === current;
		} );
		if ( known ) {
			select.value = current;
		} else if ( current ) {
			select.value = OTHER;
		} else if ( o.options && o.options.length === 1 ) {
			select.value = o.options[ 0 ].value;
		}

		select.addEventListener( 'change', function () {
			var v = select.value;
			if ( o.onChoose ) {
				o.onChoose( v === OTHER ? '' : v, v === OTHER );
			}
		} );

		if ( parent === wrap ) {
			wrap.appendChild( select );
		} else {
			parent.insertBefore( select, parent.querySelector( 'svg' ) );
		}

		if ( o.attribution && o.creditUrl ) {
			var credit = doc.createElement( 'small' );
			credit.className = 'postali-cp-credit';
			var a = doc.createElement( 'a' );
			a.href = o.creditUrl;
			a.target = '_blank';
			a.rel = 'noopener';
			a.textContent = i18n.credit || 'Postali';
			credit.appendChild( a );
			wrap.appendChild( credit );
		}

		return { el: wrap, select: select };
	}

	function safeSessionStorage() {
		try {
			if ( typeof window !== 'undefined' && window.sessionStorage ) {
				return window.sessionStorage;
			}
		} catch ( e ) {
			// Acceso bloqueado por el navegador.
		}
		return null;
	}

	return {
		STATE_MAP: STATE_MAP,
		NAME_ALIASES: NAME_ALIASES,
		slugify: slugify,
		normalizeCp: normalizeCp,
		stateCode: stateCode,
		coloniaOptions: coloniaOptions,
		cityFor: cityFor,
		createClient: createClient,
		createPicker: createPicker,
		OTHER: OTHER
	};
} ) );
