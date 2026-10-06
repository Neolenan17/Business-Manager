let usuarios = JSON.parse(localStorage.getItem('bm_usuarios')) || [];
let usuarioActivo = JSON.parse(localStorage.getItem('bm_usuario_activo')) || null;

function inicializarMigracion() {
  if (usuarios.length === 0) {
    const cuentaDefault = {
      id: 'usr_admin',
      nombre: 'Administrador',
      email: 'admin@business.com',
      password: '1234'
    };
    usuarios.push(cuentaDefault);
    localStorage.setItem('bm_usuarios', JSON.stringify(usuarios));

    const prodsAntiguos = localStorage.getItem('bm_productos');
    const facsAntiguas = localStorage.getItem('bm_facturas');

    if (prodsAntiguos) localStorage.setItem('bm_data_usr_admin_productos', prodsAntiguos);
    if (facsAntiguas) localStorage.setItem('bm_data_usr_admin_facturas', facsAntiguas);
  }
}
inicializarMigracion();

let productos = [];
let facturas = [];
let categorias = [];
let carrito = [];
let chartInstance = null;
let categoriaSeleccionada = 'TODOS';
let busquedaFiltro = '';

function conmutarAuth(mostrarRegistro) {
  document.getElementById('form-login').classList.toggle('hidden', mostrarRegistro);
  document.getElementById('form-registro').classList.toggle('hidden', !mostrarRegistro);
  document.getElementById('auth-subtitulo').textContent = mostrarRegistro 
    ? 'Crea tu cuenta para comenzar a vender' 
    : 'Inicia sesión para gestionar tu negocio';
}

function iniciarSesion(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;

  const usuario = usuarios.find(u => u.email === email && u.password === pass);
  if (!usuario) {
    alert('Correo o contraseña incorrectos.');
    return;
  }

  usuarioActivo = usuario;
  localStorage.setItem('bm_usuario_activo', JSON.stringify(usuarioActivo));
  document.getElementById('form-login').reset();
  verificarSesion();
}

function registrarCuenta(e) {
  e.preventDefault();
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const pass = document.getElementById('reg-password').value;

  if (usuarios.some(u => u.email === email)) {
    alert('Ya existe una cuenta registrada con ese correo.');
    return;
  }

  const nuevoUsuario = {
    id: 'usr_' + Date.now(),
    nombre,
    email,
    password: pass
  };

  usuarios.push(nuevoUsuario);
  localStorage.setItem('bm_usuarios', JSON.stringify(usuarios));

  const prodsDemo = [
    { id: 1, nombre: 'Producto Ejemplo', categoria: 'General', precio: 1000, stock: 20 }
  ];
  const catsDemo = ['General', 'Comidas', 'Bebidas'];

  localStorage.setItem(`bm_data_${nuevoUsuario.id}_productos`, JSON.stringify(prodsDemo));
  localStorage.setItem(`bm_data_${nuevoUsuario.id}_categorias`, JSON.stringify(catsDemo));
  localStorage.setItem(`bm_data_${nuevoUsuario.id}_facturas`, JSON.stringify([]));

  usuarioActivo = nuevoUsuario;
  localStorage.setItem('bm_usuario_activo', JSON.stringify(usuarioActivo));
  document.getElementById('form-registro').reset();
  verificarSesion();
}

function cerrarSesion() {
  if (confirm('¿Deseas cerrar la sesión?')) {
    usuarioActivo = null;
    localStorage.removeItem('bm_usuario_activo');
    verificarSesion();
  }
}

function verificarSesion() {
  const vistaAuth = document.getElementById('vista-auth');
  const vistaApp = document.getElementById('vista-app');

  if (usuarioActivo) {
    vistaAuth.classList.add('hidden');
    vistaApp.classList.remove('hidden');
    document.getElementById('label-usuario').textContent = `${usuarioActivo.nombre} (${usuarioActivo.email})`;
    cargarDatosUsuario();
    cambiarVista('pos');
  } else {
    vistaAuth.classList.remove('hidden');
    vistaApp.classList.add('hidden');
  }
}

function cargarDatosUsuario() {
  const prefijo = `bm_data_${usuarioActivo.id}_`;
  productos = JSON.parse(localStorage.getItem(prefijo + 'productos')) || [];
  facturas = JSON.parse(localStorage.getItem(prefijo + 'facturas')) || [];
  categorias = JSON.parse(localStorage.getItem(prefijo + 'categorias')) || ['General', 'Comidas', 'Bebidas'];

  productos.forEach(p => {
    if (!p.categoria) p.categoria = 'General';
  });
}

function guardarDatos() {
  const prefijo = `bm_data_${usuarioActivo.id}_`;
  localStorage.setItem(prefijo + 'productos', JSON.stringify(productos));
  localStorage.setItem(prefijo + 'facturas', JSON.stringify(facturas));
  localStorage.setItem(prefijo + 'categorias', JSON.stringify(categorias));
}

function cambiarVista(vista) {
  ['pos', 'stock', 'facturas', 'graficos'].forEach(sec => {
    document.getElementById(`vista-${sec}`).classList.add('hidden');
  });
  document.getElementById(`vista-${vista}`).classList.remove('hidden');

  if (vista === 'pos') renderizarPOS();
  if (vista === 'stock') {
    cancelarEdicion();
    renderizarSelectCategorias();
    renderizarStock();
  }
  if (vista === 'facturas') renderizarFacturas();
  if (vista === 'graficos') renderizarGraficos();
}

function renderizarBarraCategorias() {
  const contenedor = document.getElementById('contenedor-categorias-pos');
  contenedor.innerHTML = '';

  const lista = ['TODOS', ...categorias];
  lista.forEach(cat => {
    const activa = categoriaSeleccionada === cat;
    contenedor.innerHTML += `
      <button 
        onclick="seleccionarCategoria('${cat}')" 
        class="px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
          activa 
            ? 'bg-blue-600 text-white shadow-sm' 
            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
        }">
        ${cat}
      </button>
    `;
  });
}

function seleccionarCategoria(cat) {
  categoriaSeleccionada = cat;
  renderizarBarraCategorias();
  renderizarCatalogoFiltrado();
}

function filtrarProductosPOS() {
  busquedaFiltro = document.getElementById('pos-busqueda').value.toLowerCase().trim();
  renderizarCatalogoFiltrado();
}

function renderizarCatalogoFiltrado() {
  const contenedor = document.getElementById('grid-productos');
  contenedor.innerHTML = '';

  const filtrados = productos.filter(p => {
    const coincideCat = (categoriaSeleccionada === 'TODOS') || (p.categoria === categoriaSeleccionada);
    const coincideBusqueda = p.nombre.toLowerCase().includes(busquedaFiltro);
    return coincideCat && coincideBusqueda;
  });

  if (filtrados.length === 0) {
    contenedor.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 text-sm">
        No se encontraron productos con estos criterios.
      </div>
    `;
    return;
  }

  filtrados.forEach(prod => {
    const sinStock = prod.stock <= 0;
    contenedor.innerHTML += `
      <div class="border border-slate-200 rounded-xl p-3 flex flex-col justify-between ${sinStock ? 'bg-slate-100 opacity-60' : 'bg-white hover:border-blue-400 shadow-sm'}">
        <div>
          <span class="text-[10px] uppercase font-bold text-sky-600 tracking-wider block">${prod.categoria}</span>
          <h3 class="font-bold text-sm text-slate-800 leading-snug">${prod.nombre}</h3>
          <p class="text-xs text-slate-500 mt-0.5">Stock: ${prod.stock}</p>
          <p class="font-bold text-blue-600 mt-1">$${prod.precio.toFixed(2)}</p>
        </div>
        <button 
          onclick="agregarAlCarrito(${prod.id})" 
          ${sinStock ? 'disabled' : ''}
          class="mt-2 text-xs py-1.5 px-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg font-bold transition">
          ${sinStock ? 'Sin Stock' : 'Agregar +'}
        </button>
      </div>
    `;
  });
}

function renderizarPOS() {
  renderizarBarraCategorias();
  renderizarCatalogoFiltrado();
  renderizarCarrito();
}

function agregarAlCarrito(id) {
  const prod = productos.find(p => p.id === id);
  const itemEnCarrito = carrito.find(item => item.id === id);

  const cantActual = itemEnCarrito ? itemEnCarrito.cantidad : 0;
  if (cantActual + 1 > prod.stock) {
    alert('No hay suficiente stock disponible de este producto.');
    return;
  }

  if (itemEnCarrito) {
    itemEnCarrito.cantidad++;
  } else {
    carrito.push({ ...prod, cantidad: 1 });
  }
  renderizarCarrito();
}

function renderizarCarrito() {
  const contenedor = document.getElementById('items-carrito');
  const totalElem = document.getElementById('total-venta');
  contenedor.innerHTML = '';

  let total = 0;

  if (carrito.length === 0) {
    contenedor.innerHTML = '<p class="text-slate-400 text-sm">No hay productos seleccionados.</p>';
  } else {
    carrito.forEach((item, index) => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;
      contenedor.innerHTML += `
        <div class="flex justify-between items-center text-sm">
          <div>
            <p class="font-semibold text-slate-800">${item.nombre}</p>
            <p class="text-xs text-slate-500">${item.cantidad} x $${item.precio.toFixed(2)}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-800">$${subtotal.toFixed(2)}</span>
            <button onclick="eliminarDelCarrito(${index})" class="text-red-500 hover:text-red-700 font-bold px-1 text-sm">✕</button>
          </div>
        </div>
      `;
    });
  }

  totalElem.textContent = `$${total.toFixed(2)}`;
}

function eliminarDelCarrito(index) {
  carrito.splice(index, 1);
  renderizarCarrito();
}

function finalizarVenta(conFactura = true) {
  if (carrito.length === 0) {
    alert('El ticket de venta está vacío.');
    return;
  }

  carrito.forEach(item => {
    const prod = productos.find(p => p.id === item.id);
    if (prod) prod.stock -= item.cantidad;
  });

  const total = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0);
  const nuevaVenta = {
    id: 'BM-' + Date.now().toString().slice(-6),
    fecha: new Date().toLocaleString(),
    tipo: conFactura ? 'Factura' : 'Venta Simple',
    items: [...carrito],
    total: total
  };

  facturas.push(nuevaVenta);
  guardarDatos();

  carrito = [];
  renderizarPOS();

  if (conFactura) {
    verFactura(nuevaVenta.id);
  } else {
    alert(`¡Venta #${nuevaVenta.id} registrada con éxito por $${total.toFixed(2)}!`);
  }
}

function renderizarSelectCategorias(categoriaSeleccionadaPrevia = null) {
  const select = document.getElementById('prod-categoria');
  select.innerHTML = '';
  categorias.forEach(cat => {
    const selected = cat === categoriaSeleccionadaPrevia ? 'selected' : '';
    select.innerHTML += `<option value="${cat}" ${selected}>${cat}</option>`;
  });
}

function crearNuevaCategoria() {
  const nueva = prompt('Ingresa el nombre de la nueva categoría:');
  if (nueva && nueva.trim()) {
    const limpia = nueva.trim();
    if (!categorias.includes(limpia)) {
      categorias.push(limpia);
      guardarDatos();
      renderizarSelectCategorias(limpia);
    } else {
      alert('Esa categoría ya existe.');
    }
  }
}

function guardarProducto(e) {
  e.preventDefault();
  const idInput = document.getElementById('prod-id').value;
  const nombre = document.getElementById('prod-nombre').value.trim();
  const categoria = document.getElementById('prod-categoria').value;
  const precio = parseFloat(document.getElementById('prod-precio').value);
  const stock = parseInt(document.getElementById('prod-stock').value);

  if (idInput) {
    const prod = productos.find(p => p.id === Number(idInput));
    if (prod) {
      prod.nombre = nombre;
      prod.categoria = categoria;
      prod.precio = precio;
      prod.stock = stock;
    }
  } else {
    productos.push({
      id: Date.now(),
      nombre,
      categoria,
      precio,
      stock
    });
  }

  guardarDatos();
  cancelarEdicion();
  renderizarStock();
}

function iniciarEdicion(id) {
  const prod = productos.find(p => p.id === id);
  if (!prod) return;

  document.getElementById('prod-id').value = prod.id;
  document.getElementById('prod-nombre').value = prod.nombre;
  renderizarSelectCategorias(prod.categoria);
  document.getElementById('prod-precio').value = prod.precio;
  document.getElementById('prod-stock').value = prod.stock;

  document.getElementById('form-titulo').textContent = 'Editar Producto';
  document.getElementById('btn-submit-prod').textContent = 'Actualizar Producto';
  document.getElementById('btn-submit-prod').classList.replace('bg-blue-600', 'bg-emerald-600');
  document.getElementById('btn-cancelar-prod').classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicion() {
  document.getElementById('form-producto').reset();
  document.getElementById('prod-id').value = '';
  document.getElementById('form-titulo').textContent = 'Añadir Nuevo Producto';
  document.getElementById('btn-submit-prod').textContent = 'Guardar Producto';
  document.getElementById('btn-submit-prod').classList.replace('bg-emerald-600', 'bg-blue-600');
  document.getElementById('btn-cancelar-prod').classList.add('hidden');
}

function renderizarStock() {
  const tabla = document.getElementById('tabla-stock');
  tabla.innerHTML = '';

  productos.forEach(prod => {
    tabla.innerHTML += `
      <tr class="border-b text-sm hover:bg-slate-50 transition">
        <td class="p-2 font-medium text-slate-800">${prod.nombre}</td>
        <td class="p-2 text-xs">
          <span class="bg-sky-50 text-sky-700 px-2 py-0.5 rounded font-semibold border border-sky-100">${prod.categoria}</span>
        </td>
        <td class="p-2 text-slate-600">$${prod.precio.toFixed(2)}</td>
        <td class="p-2 font-semibold ${prod.stock <= 5 ? 'text-amber-600' : 'text-slate-700'}">${prod.stock}</td>
        <td class="p-2 text-right space-x-1">
          <button onclick="iniciarEdicion(${prod.id})" class="text-blue-600 hover:text-blue-800 text-xs font-bold px-2 py-1 bg-blue-50 rounded">
            Editar
          </button>
          <button onclick="eliminarProducto(${prod.id})" class="text-red-500 hover:text-red-700 text-xs font-bold px-2 py-1 bg-red-50 rounded">
            Eliminar
          </button>
        </td>
      </tr>
    `;
  });
}

function eliminarProducto(id) {
  if (confirm('¿Seguro que deseas eliminar este producto del inventario?')) {
    productos = productos.filter(p => p.id !== id);
    guardarDatos();
    renderizarStock();
  }
}

function renderizarFacturas() {
  const tabla = document.getElementById('tabla-facturas');
  tabla.innerHTML = '';

  facturas.slice().reverse().forEach(venta => {
    const esFactura = venta.tipo === 'Factura';
    tabla.innerHTML += `
      <tr class="border-b text-sm hover:bg-slate-50 transition">
        <td class="p-2 font-bold text-slate-800">${venta.id}</td>
        <td class="p-2 text-xs text-slate-500">${venta.fecha}</td>
        <td class="p-2 text-xs">
          <span class="px-2 py-0.5 rounded-full font-medium ${esFactura ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}">
            ${venta.tipo || 'Factura'}
          </span>
        </td>
        <td class="p-2 font-bold text-emerald-600">$${venta.total.toFixed(2)}</td>
        <td class="p-2 text-right">
          <button onclick="verFactura('${venta.id}')" class="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded text-xs font-semibold">
            Ver Ticket
          </button>
        </td>
      </tr>
    `;
  });
}

function verFactura(id) {
  const venta = facturas.find(f => f.id === id);
  if (!venta) return;

  const modal = document.getElementById('modal-factura');
  const contenido = document.getElementById('factura-contenido');

  let itemsHtml = venta.items.map(item => `
    <div class="flex justify-between text-xs py-1.5 border-b border-dashed border-slate-200">
      <span>${item.cantidad}x ${item.nombre}</span>
      <span class="font-semibold">$${(item.precio * item.cantidad).toFixed(2)}</span>
    </div>
  `).join('');

  contenido.innerHTML = `
    <div class="text-center mb-4">
      <h3 class="font-black text-lg tracking-wide text-slate-900">BUSINESS MANAGER</h3>
      <p class="text-[11px] text-slate-500 font-medium">${usuarioActivo.nombre}</p>
      <p class="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mt-1">${venta.tipo || 'COMPROBANTE DE VENTA'}</p>
      <p class="text-xs text-slate-500">${venta.id}</p>
      <p class="text-xs text-slate-400">${venta.fecha}</p>
    </div>
    <div class="mb-4">
      ${itemsHtml}
    </div>
    <div class="flex justify-between font-black text-base border-t-2 border-slate-800 pt-2 mb-6">
      <span>TOTAL</span>
      <span class="text-blue-600">$${venta.total.toFixed(2)}</span>
    </div>
    <div class="flex gap-2">
      <button onclick="window.print()" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-sm hover:bg-blue-700 transition">Imprimir / PDF</button>
      <button onclick="document.getElementById('modal-factura').classList.add('hidden')" class="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-sm hover:bg-slate-300 transition">Cerrar</button>
    </div>
  `;

  modal.classList.remove('hidden');
}

function renderizarGraficos() {
  const ctx = document.getElementById('ventasChart').getContext('2d');

  const ventasPorProducto = {};
  facturas.forEach(f => {
    f.items.forEach(item => {
      ventasPorProducto[item.nombre] = (ventasPorProducto[item.nombre] || 0) + (item.precio * item.cantidad);
    });
  });

  const labels = Object.keys(ventasPorProducto);
  const data = Object.values(ventasPorProducto);

  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['Sin ventas'],
      datasets: [{
        label: 'Ingresos por Producto ($)',
        data: data.length ? data : [0],
        backgroundColor: '#0284c7',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      }
    }
  });
}

verificarSesion();