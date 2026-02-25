import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function checkIfCpfIsValid(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isCPFValid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // Extrai somente os dígitos
          const cpf = value.replace(/\D/g, '');

          // Verifica se possui 11 dígitos
          if (cpf.length !== 11) {
            return false;
          }

          // Verifica se é uma sequência de dígitos repetidos (ex.: 11111111111)
          if (/^(\d)\1{10}$/.test(cpf)) {
            return false;
          }

          // Calcula e valida os dígitos verificadores
          for (let t = 9; t < 11; t++) {
            let d = 0;
            for (let c = 0; c < t; c++) {
              d += parseInt(cpf.charAt(c), 10) * ((t + 1) - c);
            }
            d = ((10 * d) % 11) % 10;
            if (parseInt(cpf.charAt(t), 10) !== d) {
              return false;
            }
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'CPF is not valid';
        },
      },
    });
  };
}