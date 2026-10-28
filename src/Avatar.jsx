export default function Avatar({ src, size }) {
  const className = `avatar${size ? ` ${size}` : ''}`
  if (src) return <img src={src} alt="" className={className} />
  return <div className={className} />
}
