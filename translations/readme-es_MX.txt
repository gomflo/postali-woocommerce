=== Postali — Códigos postales de México ===
Contributors: gomflo
Tags: woocommerce, codigo postal, mexico, checkout, sepomex
Requires at least: 6.5
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Autocomplete Mexican addresses (state, city, colonia) from the postal code at WooCommerce checkout, using the free Postali API. No API key.

== Description ==

Tus clientes escriben el **código postal** y el checkout de WooCommerce llena solo el **estado**, la **ciudad o municipio** y muestra una **lista con las colonias** de ese código postal. Menos errores de captura, menos paquetes devueltos por direcciones incompletas.

Los datos vienen del catálogo oficial de SEPOMEX (Correos de México), servidos por la API pública y gratuita de [Postali](https://postali.app/api): sin registro, sin clave de API, sin cuotas.

= Qué hace =

* Al escribir un CP de 5 dígitos con país **México**, llena el estado (con los códigos de estado de WooCommerce), la ciudad (municipio o alcaldía) y convierte la colonia en una lista desplegable.
* Si el CP tiene una sola colonia, la elige sola.
* Opción **"Otra (escribirla a mano)"** para colonias nuevas o que no aparecen en SEPOMEX. El cliente siempre puede corregir cualquier campo.
* Funciona en facturación y en envío, y en **Mi cuenta > Direcciones**.
* Si la API no responde o el CP no existe, avisa con un mensaje discreto y deja llenar la dirección a mano. **Nunca bloquea el checkout** por una falla de red.
* Caché en el navegador (por sesión) para no repetir consultas.
* **Validación opcional en el servidor**: al confirmar el pedido, rechaza códigos postales inexistentes o que no corresponden al estado elegido. Usa caché de una semana. Si la API no responde, el pedido se acepta.
* Compatible con HPOS (tablas de pedidos de alto rendimiento).

= Dónde se guarda la colonia =

Por defecto, en **"Dirección línea 2"** (`address_2`), con la etiqueta "Colonia". Es la convención más común en tiendas mexicanas: la línea 1 queda para calle y número, la línea 2 para la colonia. Así la colonia aparece sin configurar nada en correos, facturas, etiquetas de paquetería, exportaciones y en cualquier integración que lea la dirección estándar de WooCommerce.

Si prefieres un campo aparte, elige **"Campo propio Colonia"** en los ajustes. Se guarda como campo adicional del pedido (`_wc_billing/postali/colonia` y `_wc_shipping/postali/colonia`, el mismo formato que usa el checkout de bloques), y se añade a la dirección de México formateada en la pantalla del pedido, los correos y la página de gracias. Ten en cuenta que muchas integraciones de paquetería sólo leen `address_2`.

= Checkout clásico y checkout de bloques =

* **Checkout clásico** (shortcode `[woocommerce_checkout]`): soporte completo.
* **Checkout de bloques**: soportado. Estado, ciudad y colonia se escriben en el almacén de datos del checkout (`wc/store/cart`), así que React y el servidor ven los mismos valores. El selector de colonias aparece justo debajo del campo de código postal, con el mismo marcado que los selects de WooCommerce. Como el checkout de bloques no permite reemplazar sus campos por otros, el selector es un elemento propio del plugin que escribe en "Dirección línea 2" (o en el campo propio "Colonia", que se registra con la API de campos adicionales de WooCommerce y sólo se muestra para México desde WooCommerce 9.9). Si un tema o plugin modifica mucho el formulario de bloques, el autocompletado de estado y ciudad sigue funcionando aunque el selector no se pueda insertar.

= Ajustes =

En **WooCommerce > Ajustes > Postali**:

* Activar o desactivar el autocompletado.
* Qué campos llenar: estado, ciudad, colonia.
* Qué poner en "Ciudad": municipio/alcaldía (recomendado para paqueterías) o la ciudad de SEPOMEX.
* Dónde guardar la colonia: "Dirección línea 2" o campo propio.
* Mostrar el código postal antes de la calle (México).
* Validación en el servidor.
* Crédito "Datos: Postali" (desactivado por defecto).

= Crédito opcional =

El plugin puede mostrar un enlace pequeño "Datos: Postali" debajo del campo de colonia. **Está desactivado por defecto** y sólo aparece si lo activas en los ajustes. El plugin funciona exactamente igual sin él.

== External services ==

Este plugin se conecta a la **API de Postali** (https://postali.app), un servicio externo, para obtener el estado, el municipio y las colonias de un código postal mexicano. Sin esa consulta el plugin no puede autocompletar la dirección.

**Qué se envía y cuándo**

* **Desde el navegador del cliente**, en las páginas de checkout y de "Mi cuenta > Direcciones": cuando el país es México y el cliente escribe un código postal de 5 dígitos, el navegador pide `https://postali.app/api/v1/mx/cp/{código postal}`. Sólo se envía el código postal, en la URL. Como en cualquier petición web, el servidor recibe además la dirección IP y el agente de usuario (navegador) del cliente. No se envían nombre, calle, correo, teléfono ni datos del pedido. La petición se hace sin cookies (`credentials: omit`).
* **Desde el servidor de la tienda**, sólo si activas "Validación en el servidor": al confirmar un pedido con dirección en México, WordPress pide la misma URL con el código postal de la dirección. Se envía sólo el código postal; la respuesta se guarda en caché una semana.

El servicio lo presta Postali. Términos de uso: https://postali.app/terminos — Aviso de privacidad: https://postali.app/privacidad — Documentación: https://postali.app/api/docs

Los datos de códigos postales provienen de SEPOMEX (Servicio Postal Mexicano).

== Installation ==

1. Instala y activa WooCommerce.
2. Sube la carpeta `postali-codigos-postales` a `/wp-content/plugins/` o instálalo desde **Plugins > Añadir nuevo**.
3. Activa el plugin.
4. Revisa **WooCommerce > Ajustes > Postali**. Viene listo para usarse: llena estado, ciudad y colonia, y guarda la colonia en "Dirección línea 2".

== Frequently Asked Questions ==

= ¿Necesito una clave de API o una cuenta? =

No. La API de Postali es pública y gratuita.

= ¿Qué pasa si la API no responde? =

El cliente ve un aviso ("No pudimos consultar el código postal") y llena la dirección a mano. El checkout nunca se bloquea por una falla de red, ni siquiera con la validación en servidor activada.

= ¿Por qué Ciudad de México aparece con el código "DF"? =

Es el código que WooCommerce usa internamente para Ciudad de México (y "MX" para Estado de México). El plugin traduce los nombres de SEPOMEX a esos códigos; el cliente sólo ve el nombre.

= Mi colonia no aparece en la lista =

Elige "Otra (escribirla a mano)" y escríbela. SEPOMEX tarda en registrar fraccionamientos nuevos.

= ¿Funciona para Colombia o España? =

La API de Postali también tiene datos de Colombia y España, pero esta versión del plugin sólo autocompleta direcciones de México.

= ¿Puedo usar mi propio servidor de la API? =

Sí, con el filtro `postali_cp_api_base` (en PHP) cambias la URL base, tanto para el navegador como para la validación en servidor.

== Changelog ==

= 1.0.0 =
* Primera versión: autocompletado de estado, ciudad y colonia por código postal en el checkout clásico, el checkout de bloques y Mi cuenta; validación opcional en servidor; crédito opcional desactivado por defecto.

== Upgrade Notice ==

= 1.0.0 =
Primera versión.
