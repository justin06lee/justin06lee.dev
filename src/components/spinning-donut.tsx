
export default function SpinningDonut() {

	const R = 20
	const r = 5

	let A = 0
	let B = 0

	let phi = 0
	let theta = 0

	let centerX = 300
	let centerY = 300

	let scale = 5
	let K = 10

	let x = (R + r * Math.cos(theta)) * Math.cos(phi)
	let y = (R + r * Math.cos(theta)) * Math.sin(phi)
	let z = r * Math.sin(theta)

	let y_ = y * Math.cos(A) - z * Math.sin(A)
	let z_ = y * Math.sin(A) + z * Math.cos(A)
	let x_ = x

	let x__ = x_ * Math.cos(B) - y_ * Math.sin(B)
	let y__ = x_ * Math.sin(B) + y_ * Math.cos(B)
	let z__ = z_

	let screenX = centerX + scale * (x__ / (z__ + K))
	let screenY = centerY + scale * (y__ / (z__ + K))

	let chars = [".", ",", "-", "~", ":", ";", "=", "!", "*", "#", "$", "@"]


	return (
		<div>
			<div></div>
		</div>
	);
}
