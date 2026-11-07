import { CAR } from '../../constants';
import type { CarState } from '../../types';

type CreateCarPhysicsArgs = {
  car: CarState;
  down: (...names: string[]) => boolean;
  blocked: (px: number, py: number) => boolean;
  applyCarTransform: (car: CarState) => void;
  spinWheels: (car: CarState, dt: number) => void;
};

export function createCarPhysics({ car, down, blocked, applyCarTransform, spinWheels }: CreateCarPhysicsArgs) {
  const updateCar = (dt: number) => {
    const gas = down('w', 'arrowup');
    const rev = down('s', 'arrowdown');
    const left = down('a', 'arrowleft');
    const right = down('d', 'arrowright');
    const hand = down(' ');

    if (gas) {
      car.speed += (car.speed < 0 ? CAR.brake : CAR.accel) * dt;
    } else if (rev) {
      car.speed -= (car.speed > 0 ? CAR.brake : CAR.accel * 0.7) * dt;
    } else {
      const f = CAR.friction * dt;
      if (Math.abs(car.speed) <= f) car.speed = 0;
      else car.speed -= Math.sign(car.speed) * f;
    }

    if (hand) {
      const f = CAR.handbrake * dt;
      if (Math.abs(car.speed) <= f) car.speed = 0;
      else car.speed -= Math.sign(car.speed) * f;
    }

    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));

    const steer = (left ? 1 : 0) - (right ? 1 : 0);
    const grip = Math.min(1, Math.abs(car.speed) / 80);
    car.heading += steer * CAR.turnRate * grip * Math.sign(car.speed) * dt;

    const dx = Math.cos(car.heading) * car.speed * dt;
    const dy = Math.sin(car.heading) * car.speed * dt;

    let hit = false;
    if (!blocked(car.x + dx, car.y)) car.x += dx;
    else hit = true;
    if (!blocked(car.x, car.y + dy)) car.y += dy;
    else hit = true;

    if (hit) car.speed *= -0.25;

    applyCarTransform(car);
    spinWheels(car, dt);
  };

  return {
    updateCar,
  };
}
