import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'PinValidator', async: false })
export class PinValidator implements ValidatorConstraintInterface {
  validate(pin: string) {
    if (!/^(\d{6}|\d{8})$/.test(pin)) return false;
    if (/^(\d)\1+$/.test(pin)) return false;
    const consecutivoAsc = '0123456789';
    const consecutivoDesc = '9876543210';
    if (consecutivoAsc.includes(pin)) return false;
    if (consecutivoDesc.includes(pin)) return false;
    return true;
  }

  defaultMessage() {
    return 'El PIN debe tener exactamente 6 u 8 dígitos, no puede ser consecutivo ni todos iguales';
  }
}
