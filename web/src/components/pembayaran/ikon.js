import { Bus, BusFront, Car, CreditCard, Landmark, QrCode, TrainFront, Wallet } from 'lucide-react'
import ParkirIcon from './ParkirIcon.jsx'

export const IKON_JENIS = {
  kereta: TrainFront,
  bus: BusFront,
  bus_antarkota: Bus,
  travel: Car,
  parkir: ParkirIcon,
}

export const IKON_METODE = {
  kartu: CreditCard,
  ewallet: Wallet,
  transfer: Landmark,
  qris: QrCode,
}
