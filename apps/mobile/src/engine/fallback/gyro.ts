import { Euler, Quaternion, Vector3 } from 'three';

const zAxis = new Vector3(0, 0, 1);
const euler = new Euler();
const screenTwist = new Quaternion();
// The device's camera looks out of the back of the phone: rotate -90° about X.
const backCamera = new Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
const DEG = Math.PI / 180;

/**
 * World orientation of the phone's back camera from DeviceOrientationEvent angles (degrees),
 * compensated for the current screen rotation. Same maths as three.js' former
 * DeviceOrientationControls.
 */
export function deviceQuaternion(
  alpha: number,
  beta: number,
  gamma: number,
  screenAngleDeg: number,
  out: Quaternion,
): Quaternion {
  euler.set(beta * DEG, alpha * DEG, -gamma * DEG, 'YXZ');
  out.setFromEuler(euler);
  out.multiply(backCamera);
  out.multiply(screenTwist.setFromAxisAngle(zAxis, -screenAngleDeg * DEG));
  return out;
}

export function screenAngle(): number {
  return window.screen.orientation?.angle ?? 0;
}
