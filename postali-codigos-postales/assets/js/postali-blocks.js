/**
 * Postali — checkout de bloques de WooCommerce.
 *
 * Los campos del checkout de bloques son componentes React que leen su valor
 * del store "wc/store/cart". En vez de tocar los inputs, se escucha ese store
 * y se actualiza con setShippingAddress / setBillingAddress: así React y el
 * servidor (Store API) ven los mismos datos.
 *
 * El select de colonias es un elemento propio que se inserta después del
 * campo de CP; al elegir, escribe la colonia en address_2 (o en el campo
 * adicional postali/colonia).
 *
 * @package Postali_Codigos_Postales
 * @license GPL-2.0-or-later
 */
( function ( wp, core, config ) {
	'use strict';

	if ( ! wp || ! wp.data || ! core || ! config ) {
		return;
	}

	var STORE = 'wc/store/cart';
	var i18n = config.i18n || {};
	var client = core.createClient( { apiBase: config.apiBase } );
	var colKey = config.coloniaField === 'dedicated' ? 'postali/colonia' : 'address_2';

	var groups = {
		shipping: { key: 'shippingAddress', action: 'setShippingAddress' },
		billing: { key: 'billingAddress', action: 'setBillingAddress' }
	};
	Object.keys( groups ).forEach( function ( g ) {
		var st = groups[ g ];
		st.cp = null;
		st.seq = 0;
		st.seen = false;
		st.data = null;
		st.options = [];
		st.lastOptions = [];
		st.message = '';
		st.messageKind = '';
		st.container = null;
		st.picker = null;
		st.pickerFor = '';
	} );

	function customer() {
		var s = wp.data.select( STORE );
		return s && typeof s.getCustomerData === 'function' ? s.getCustomerData() : null;
	}

	function address( g ) {
		var c = customer();
		return ( c && c[ groups[ g ].key ] ) || {};
	}

	function useShippingAsBilling() {
		var s = wp.data.select( 'wc/store/checkout' );
		return !! ( s && typeof s.getUseShippingAsBilling === 'function' && s.getUseShippingAsBilling() );
	}

	function patchAddress( g, patch ) {
		var d = wp.data.dispatch( STORE );
		if ( ! d || ! Object.keys( patch ).length ) {
			return;
		}
		if ( typeof d[ groups[ g ].action ] === 'function' ) {
			d[ groups[ g ].action ]( patch );
		}
		// Con "Usar la misma dirección para facturación", WooCommerce sólo copia
		// lo que pasa por su propio formulario: se replica a mano.
		if ( g === 'shipping' && useShippingAsBilling() && typeof d.setBillingAddress === 'function' ) {
			d.setBillingAddress( patch );
		}
	}

	/* ---------- Interfaz (select + mensajes) ---------- */

	function postcodeWrapper( g ) {
		var input = document.getElementById( g + '-postcode' );
		if ( ! input ) {
			return null;
		}
		return input.closest( '.wc-block-components-text-input' ) || input.parentElement;
	}

	function removeUI( g ) {
		var st = groups[ g ];
		if ( st.container && st.container.parentNode ) {
			st.container.parentNode.removeChild( st.container );
		}
		st.container = null;
		st.picker = null;
		st.pickerFor = '';
	}

	function syncPickerValue( g ) {
		var st = groups[ g ];
		if ( ! st.picker ) {
			return;
		}
		var current = String( address( g )[ colKey ] || '' );
		var known = st.options.some( function ( o ) {
			return o.value === current;
		} );
		var wanted = known ? current : ( current ? core.OTHER : '' );
		// Si el cliente eligió "Otra" y aún no escribe nada, se respeta.
		if ( ! current && st.picker.select.value === core.OTHER ) {
			markHide( st );
			return;
		}
		if ( st.picker.select.value !== wanted ) {
			st.picker.select.value = wanted;
		}
		markHide( st );
	}

	/**
	 * Con una colonia elegida de la lista, el campo de texto sobra: se oculta
	 * por CSS (:has) con una marca en el contenedor propio, sin tocar los
	 * nodos de React. Con "Otra" o vacío, el campo vuelve a verse.
	 */
	function markHide( st ) {
		if ( ! st.container || ! st.picker ) {
			return;
		}
		var v = st.picker.select.value;
		if ( v && v !== core.OTHER ) {
			st.container.setAttribute( 'data-postali-hide-text', '' );
		} else {
			st.container.removeAttribute( 'data-postali-hide-text' );
		}
	}

	function focusColoniaInput( g ) {
		var id = colKey === 'address_2' ? g + '-address_2' : g + '-postali-colonia';
		var input = document.getElementById( id );
		if ( ! input && colKey === 'address_2' ) {
			// El checkout de bloques esconde address_2 tras un botón "+ Añadir…".
			var form = document.getElementById( g + '-postcode' );
			form = form && form.closest( '.wc-block-components-address-form' );
			var toggle = form && form.querySelector( '.wc-block-components-address-form__address_2-toggle' );
			if ( toggle ) {
				toggle.click();
			}
			setTimeout( function () {
				var el = document.getElementById( id );
				if ( el ) {
					el.focus();
				}
			}, 50 );
			return;
		}
		if ( input ) {
			input.focus();
		}
	}

	function ensureUI( g ) {
		var st = groups[ g ];
		var wrapper = postcodeWrapper( g );
		var wantPicker = config.fillColonia && st.data && st.options.length > 1;
		var wantMessage = !! st.message;

		if ( ! wrapper || ( ! wantPicker && ! wantMessage ) ) {
			removeUI( g );
			return;
		}

		if ( ! st.container ) {
			st.container = document.createElement( 'div' );
			st.container.className = 'postali-cp-blocks';
		}
		// React puede volver a montar el formulario: re-adjuntar si se perdió.
		if ( st.container.previousElementSibling !== wrapper ) {
			wrapper.insertAdjacentElement( 'afterend', st.container );
		}

		var status = st.container.querySelector( '.postali-cp-status' );
		if ( wantMessage ) {
			if ( ! status ) {
				status = document.createElement( 'span' );
				status.className = 'postali-cp-status';
				status.setAttribute( 'role', 'status' );
				status.setAttribute( 'aria-live', 'polite' );
				st.container.insertBefore( status, st.container.firstChild );
			}
			status.textContent = st.message;
			status.setAttribute( 'data-kind', st.messageKind );
		} else if ( status ) {
			status.parentNode.removeChild( status );
		}

		if ( ! wantPicker ) {
			if ( st.picker ) {
				st.picker.el.parentNode.removeChild( st.picker.el );
				st.picker = null;
				st.pickerFor = '';
			}
			return;
		}

		if ( ! st.picker || st.pickerFor !== st.cp ) {
			if ( st.picker ) {
				st.picker.el.parentNode.removeChild( st.picker.el );
			}
			st.picker = core.createPicker( document, {
				id: g + '-postali-colonia-select',
				options: st.options,
				current: String( address( g )[ colKey ] || '' ),
				i18n: i18n,
				blocksMarkup: true,
				attribution: config.attribution,
				creditUrl: config.creditUrl,
				onChoose: function ( value, isOther ) {
					var patch = {};
					patch[ colKey ] = value;
					if ( ! isOther && config.fillCity && config.citySource === 'ciudad' ) {
						patch.city = core.cityFor( st.data, 'ciudad', value );
					}
					patchAddress( g, patch );
					markHide( st );
					if ( isOther ) {
						focusColoniaInput( g );
					}
				}
			} );
			st.pickerFor = st.cp;
			st.container.appendChild( st.picker.el );
		}
		syncPickerValue( g );
	}

	function ensureAll() {
		Object.keys( groups ).forEach( ensureUI );
	}

	/* ---------- Lógica ---------- */

	function wasOldColonia( st, value ) {
		return ( st.lastOptions || [] ).some( function ( o ) {
			return o.value === value;
		} );
	}

	function apply( g, data, initial ) {
		var st = groups[ g ];
		var cur = address( g );
		var patch = {};

		st.options = core.coloniaOptions( data );

		if ( config.fillState ) {
			var code = core.stateCode( data );
			if ( code && cur.state !== code && ( ! initial || ! cur.state ) ) {
				patch.state = code;
			}
		}

		var colonia = String( cur[ colKey ] || '' );
		if ( config.fillColonia ) {
			var known = st.options.some( function ( o ) {
				return o.value === colonia;
			} );
			var stale = ! initial && wasOldColonia( st, colonia );
			if ( ! known && st.options.length === 1 && ( ! colonia || stale ) ) {
				colonia = st.options[ 0 ].value;
				patch[ colKey ] = colonia;
			} else if ( ! known && colonia && stale ) {
				// Era una colonia del CP anterior: ya no aplica.
				colonia = '';
				patch[ colKey ] = '';
			}
		}

		if ( config.fillCity ) {
			var city = core.cityFor( data, config.citySource, colonia );
			if ( city && cur.city !== city && ( ! initial || ! cur.city ) ) {
				patch.city = city;
			}
		}

		patchAddress( g, patch );
	}

	function check( g ) {
		var st = groups[ g ];
		var addr = address( g );
		// "initial": la dirección ya venía llena (cliente con dirección guardada).
		// En ese caso sólo se llenan campos vacíos.
		var initial = ! st.seen;
		if ( Object.prototype.hasOwnProperty.call( addr, 'postcode' ) ) {
			st.seen = true;
		}

		var cp = addr.country === 'MX' ? core.normalizeCp( addr.postcode ) : null;
		if ( cp === st.cp ) {
			return;
		}

		st.cp = cp;
		st.seq++;
		st.data = null;
		if ( st.options.length ) {
			st.lastOptions = st.options;
		}
		st.options = [];
		st.message = '';

		if ( ! cp ) {
			ensureUI( g );
			return;
		}

		var seq = st.seq;
		client.lookup( cp ).then( function ( r ) {
			if ( seq !== st.seq ) {
				return;
			}
			if ( r.status === 'found' ) {
				st.data = r.data;
				st.message = '';
				apply( g, r.data, initial );
			} else {
				st.message = r.status === 'not_found' ? i18n.notFound : i18n.networkError;
				st.messageKind = r.status;
			}
			ensureUI( g );
		} );
	}

	var scheduled = false;
	function tick() {
		if ( scheduled ) {
			return;
		}
		scheduled = true;
		setTimeout( function () {
			scheduled = false;
			if ( ! customer() ) {
				return;
			}
			Object.keys( groups ).forEach( function ( g ) {
				check( g );
				syncPickerValue( g );
			} );
			ensureAll();
		} );
	}

	wp.data.subscribe( tick );

	if ( typeof MutationObserver !== 'undefined' ) {
		var uiScheduled = false;
		var observer = new MutationObserver( function () {
			// Sólo re-adjunta; no consulta la API.
			if ( ! uiScheduled ) {
				uiScheduled = true;
				setTimeout( function () {
					uiScheduled = false;
					ensureAll();
				} );
			}
		} );
		var start = function () {
			var root = document.querySelector( '.wp-block-woocommerce-checkout' ) || document.body;
			observer.observe( root, { childList: true, subtree: true } );
			tick();
		};
		if ( document.readyState === 'loading' ) {
			document.addEventListener( 'DOMContentLoaded', start );
		} else {
			start();
		}
	} else {
		tick();
	}
}( window.wp, window.PostaliCore, window.postaliCpConfig ) );
