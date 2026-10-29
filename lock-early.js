// Ako je uključeno zaključavanje, sakrij sadržaj prije nego se išta prikaže
try { if (localStorage.getItem('fp:lock')) document.documentElement.classList.add('locked'); } catch (e) {}
