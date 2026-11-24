// Kemunculan sekali saat digulir (IntersectionObserver + motion.css). Pakai sebagai ref:
//   <h2 ref={revealUp}>, <ul ref={revealList}>, <span ref={revealLeft}>
// Elemen yang sudah di layar saat dipasang hanya bergeser (tidak disembunyikan).

const JEDA = 80
const MAKS = 500

export const kurangiGerak = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function bersihkan(el) {
  delete el.dataset.reveal
  el.style.removeProperty('--reveal-delay')
  el.style.removeProperty('--reveal-dari')
}

function mainkan(els, mode) {
  const jeda = Math.min(JEDA, MAKS / Math.max(1, els.length - 1))
  els.forEach((el, i) => {
    el.style.setProperty('--reveal-delay', `${Math.round(i * jeda)}ms`)
    el.dataset.reveal = mode
    const selesai = (e) => {
      if (e.target !== el) return
      el.removeEventListener('animationend', selesai)
      bersihkan(el)
    }
    el.addEventListener('animationend', selesai)
  })
}

function pasang(els, dari) {
  if (!els.length || typeof IntersectionObserver === 'undefined' || kurangiGerak()) return undefined
  const tinggi = window.innerHeight
  // Baca semua posisi dulu, baru tulis: satu kali layout saja.
  const diLayar = els.map((el) => el.getBoundingClientRect().top < tinggi)
  if (dari) els.forEach((el) => el.style.setProperty('--reveal-dari', dari))

  mainkan(els.filter((_, i) => diLayar[i]), 'geser')

  const nanti = els.filter((_, i) => !diLayar[i])
  const io = new IntersectionObserver(
    (entri) => {
      const masuk = entri.filter((e) => e.isIntersecting).map((e) => e.target)
      masuk.forEach((el) => io.unobserve(el))
      mainkan(masuk, 'muncul')
    },
    { rootMargin: '0px 0px -5% 0px' },
  )
  nanti.forEach((el) => {
    el.dataset.reveal = 'tunggu'
    io.observe(el)
  })
  return () => {
    io.disconnect()
    els.forEach(bersihkan)
  }
}

// React memanggil ref(null) saat lepas bila tidak ada fungsi pembersih.
export const revealUp = (el) => el && pasang([el])
export const revealLeft = (el) => el && pasang([el], 'translateX(-32px)')
/** Anak-anak daftar/grid muncul berurutan. */
export const revealList = (el) => el && pasang([...el.children])
