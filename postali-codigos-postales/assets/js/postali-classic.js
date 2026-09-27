/**
 * Postali — checkout clásico ([woocommerce_checkout]) y "Mi cuenta > Direcciones".
 *
 * Al escribir un CP de 5 dígitos con país México: llena estado y ciudad, y
 * cambia el campo de colonia por un select con las colonias del CP. La
 * opción "Otra" devuelve el campo de texto. Si la API falla, el formulario
 * queda tal cual: nunca se bloquea el checkout.
 *
 * @package Postali_Codigos_Postales
 * @license GPL-2.0-or-later
 */
( function ( $, core, config ) {
	'use strict';

	if ( ! $ || ! core || ! config ) {
		return;
	}

	var i18n = config.i18n || {};
	var client = core.createClient( { apiBase: config.apiBase } );
	var PREFIXES = [ 'billing', 'shipping' ];
	var HIDDEN = 'postali-cp-hidden';
	var state = {};
	var timers = {};

	PREFIXES.forEach( function ( p ) {
		state[ p ] = { cp: null, seq: 0, lastOptions: [] };
	} );

	function field( prefix, name ) {
		return $( '#' + prefix + '_' + name );
	}

	function countryOf( prefix ) {
		var $c = field( prefix, 'country' );
		return $c.length ? String( $c.val() || '' ) : '';
	}

	function coloniaInput( prefix ) {
		return config.coloniaField === 'dedicated' ? field( prefix, 'postali_colonia' ) : field( prefix, 'address_2' );
	}

	function setStatus( prefix, text, kind ) {
		var id = prefix + '_postali_status';
		var $s = $( '#' + id );
		if ( ! text ) {
			$s.remove();
			return;
		}
		if ( ! $s.length ) {
			var $row = field( prefix, 'postcode' ).closest( '.form-row' );
			if ( ! $row.length ) {
				return;
			}
			$s = $( '<span/>', { id: id, 'class': 'postali-cp-status', role: 'status', 'aria-live': 'polite' } );
			$row.append( $s );
		}
		$s.text( text ).attr( 'data-kind', kind || '' );
	}

	function removePicker( prefix ) {
		$( '#' + prefix + '_postali_picker' ).remove();
		var $in = coloniaInput( prefix );
		$in.removeClass( HIDDEN );
		var $label = $in.closest( '.form-row' ).find( 'label' ).first();
		if ( $label.attr( 'data-postali-for' ) ) {
			$label.attr( 'for', $label.attr( 'data-postali-for' ) ).removeAttr( 'data-postali-for' );
		}
	}

	function setText( $el, value, onlyIfEmpty ) {
		if ( ! $el.length || ! value ) {
			return;
		}
		if ( onlyIfEmpty && $el.val() ) {
			return;
		}
		if ( $el.val() !== value ) {
			$el.val( value ).trigger( 'change' );
		}
	}

	function setState( prefix, code, onlyIfEmpty ) {
		var $s = field( prefix, 'state' );
		if ( ! $s.length || ! code ) {
			return;
		}
		if ( onlyIfEmpty && $s.val() ) {
			return;
		}
		if ( $s.is( 'select' ) && ! $s.find( 'option' ).filter( function () {
			return this.value === code;
		} ).length ) {
			return;
		}
		if ( $s.val() !== code ) {
			// selectWoo escucha "change" para refrescar su vista.
			$s.val( code ).trigger( 'change' );
		}
	}

	/**
	 * Muchos temas estilizan los inputs del checkout pero no los <select>.
	 * Se copia el aspecto del campo de CP para que el select no desentone.
	 */
	function matchLook( select, ref ) {
		if ( ! ref || ! window.getComputedStyle || ! ref.offsetHeight ) {
			return;
		}
		var cs = window.getComputedStyle( ref );
		[ 'boxSizing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'fontSize', 'fontFamily', 'lineHeight',
			'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'borderColor',
			'borderRadius', 'backgroundColor', 'color' ].forEach( function ( prop ) {
			select.style[ prop ] = cs[ prop ];
		} );
		select.style.boxSizing = 'border-box';
		select.style.height = ref.offsetHeight + 'px';
	}

	function buildPicker( prefix, data, initial ) {
		var $in = coloniaInput( prefix );
		removePicker( prefix );
		if ( ! $in.length ) {
			return;
		}

		var options = core.coloniaOptions( data );
		if ( ! options.length ) {
			return;
		}

		var current = String( $in.val() || '' );
		var known = options.some( function ( o ) {
			return o.value === current;
		} );
		// Con un CP nuevo, una colonia del CP anterior ya no sirve. Lo que el
		// cliente escribió a mano (no estaba en la lista anterior) se respeta.
		var wasOld = state[ prefix ].lastOptions.some( function ( o ) {
			return o.value === current;
		} );
		state[ prefix ].lastOptions = options;
		if ( ! initial && ! known && current && wasOld ) {
			$in.val( '' ).trigger( 'change' );
			current = '';
		}

		var selectId = prefix + '_postali_colonia_select';
		var picker = core.createPicker( document, {
			id: selectId,
			options: options,
			current: current,
			i18n: i18n,
			showLabel: false,
			attribution: config.attribution,
			creditUrl: config.creditUrl,
			onChoose: function ( value, isOther ) {
				if ( isOther ) {
					$in.removeClass( HIDDEN ).val( '' ).trigger( 'change' ).trigger( 'focus' );
					return;
				}
				$in.addClass( HIDDEN ).val( value ).trigger( 'change' );
				if ( config.fillCity && config.citySource === 'ciudad' ) {
					setText( field( prefix, 'city' ), core.cityFor( data, 'ciudad', value ), false );
				}
			}
		} );
		picker.el.id = prefix + '_postali_picker';

		var $row = $in.closest( '.form-row' );
		var $wrapper = $in.closest( '.woocommerce-input-wrapper' );
		( $wrapper.length ? $wrapper : $in ).after( picker.el );

		// La etiqueta ("Colonia") apunta al select mientras exista.
		var $label = $row.find( 'label' ).first();
		$label.removeClass( 'screen-reader-text' );
		if ( ! $label.attr( 'data-postali-for' ) ) {
			$label.attr( 'data-postali-for', $label.attr( 'for' ) || $in.attr( 'id' ) );
		}
		$label.attr( 'for', selectId );

		matchLook( picker.select, field( prefix, 'postcode' )[ 0 ] );

		var chosen = picker.select.value;
		if ( chosen === core.OTHER ) {
			$in.removeClass( HIDDEN );
		} else {
			$in.addClass( HIDDEN );
			if ( chosen && chosen !== current ) {
				$in.val( chosen ).trigger( 'change' );
			}
		}
	}

	function apply( prefix, data, initial ) {
		if ( config.fillState ) {
			setState( prefix, core.stateCode( data ), initial );
		}
		if ( config.fillColonia ) {
			buildPicker( prefix, data, initial );
		}
		if ( config.fillCity ) {
			setText( field( prefix, 'city' ), core.cityFor( data, config.citySource, String( coloniaInput( prefix ).val() || '' ) ), initial );
		}
	}

	/**
	 * @param {string}  prefix  billing|shipping
	 * @param {boolean} initial true = carga de página o cambio de país: sólo llena campos vacíos.
	 * @param {boolean} force   repetir aunque el CP no haya cambiado.
	 */
	function handle( prefix, initial, force ) {
		var st = state[ prefix ];
		var $pc = field( prefix, 'postcode' );
		if ( ! $pc.length ) {
			return;
		}

		var cp = countryOf( prefix ) === 'MX' ? core.normalizeCp( $pc.val() ) : null;
		if ( ! cp ) {
			if ( st.cp ) {
				st.seq++;
				st.cp = null;
				removePicker( prefix );
				setStatus( prefix, '' );
			}
			return;
		}
		if ( cp === st.cp && ! force ) {
			return;
		}

		st.cp = cp;
		var seq = ++st.seq;
		setStatus( prefix, i18n.loading, 'loading' );

		client.lookup( cp ).then( function ( r ) {
			if ( seq !== st.seq ) {
				return; // El cliente ya escribió otro CP.
			}
			if ( r.status === 'found' ) {
				setStatus( prefix, '' );
				apply( prefix, r.data, initial );
			} else {
				removePicker( prefix );
				setStatus( prefix, r.status === 'not_found' ? i18n.notFound : i18n.networkError, r.status );
			}
		} );
	}

	function schedule( prefix, initial, force ) {
		clearTimeout( timers[ prefix ] );
		timers[ prefix ] = setTimeout( function () {
			handle( prefix, initial, force );
		}, 250 );
	}

	$( document.body ).on( 'input change', '#billing_postcode, #shipping_postcode', function () {
		schedule( this.id.indexOf( 'shipping' ) === 0 ? 'shipping' : 'billing', false, false );
	} );

	// WooCommerce reconstruye el campo de estado al cambiar de país.
	$( document.body ).on( 'country_to_state_changed', function () {
		PREFIXES.forEach( function ( p ) {
			schedule( p, true, true );
		} );
	} );

	$( function () {
		PREFIXES.forEach( function ( p ) {
			handle( p, true, true );
		} );
	} );
}( window.jQuery, window.PostaliCore, window.postaliCpConfig ) );
