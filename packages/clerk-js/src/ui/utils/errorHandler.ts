import { snakeToCamel } from '@clerk/shared';
import type { ClerkAPIError, PasswordSettingsData } from '@clerk/types';

import { isClerkAPIResponseError, isKnownError, isMetamaskError } from '../../core/resources/internal';
import type { LocalizationKey } from '../localization';
import { createPasswordError } from '../utils';
import type { FormControlState } from './useFormControl';

interface ParserErrors {
  fieldErrors: ClerkAPIError[];
  globalErrors: ClerkAPIError[];
}

const PASSWORD = 'password';
function setFieldErrors(
  fieldStates: Array<FormControlState<string>>,
  errors: ClerkAPIError[],
  localizationConfig?: any,
) {
  if (!errors || errors.length < 1) {
    return;
  }

  fieldStates.forEach(field => {
    const passwordError = errors.filter(err => {
      return (
        err.meta!.paramName === PASSWORD ||
        snakeToCamel(err.meta!.paramName) === PASSWORD ||
        err.meta!.paramName === 'newPassword' ||
        snakeToCamel(err.meta!.paramName) === 'newPassword'
      );
    });

    const error = errors
      .filter(err => err.meta?.paramName !== PASSWORD && err.meta?.paramName !== 'newPassword')
      .find(err => {
        return err.meta!.paramName === field.id || snakeToCamel(err.meta!.paramName) === field.id;
      });

    if ((field.id === PASSWORD || field.id === 'newPassword') && passwordError.length) {
      const passwordErrorMessage = createPasswordError(passwordError, localizationConfig);

      field.setError(passwordErrorMessage || undefined);
    } else {
      field.setError(error || undefined);
    }
  });
}

function parseErrors(errors: ClerkAPIError[]): ParserErrors {
  return (errors || []).reduce(
    (memo, err) => {
      if (err.meta!.paramName) {
        memo.fieldErrors.push(err);
      } else {
        memo.globalErrors.push(err);
      }
      return memo;
    },
    {
      fieldErrors: Array<ClerkAPIError>(0),
      globalErrors: Array<ClerkAPIError>(0),
    },
  );
}

type HandleError = {
  (
    err: Error,
    fieldStates: Array<FormControlState<string>>,
    setGlobalError?: (err: ClerkAPIError | string | undefined) => void,
    localizationConfig?: {
      passwordSettings: PasswordSettingsData;
      locale: string;
      t: (localizationKey: LocalizationKey | string | undefined) => string;
    },
  ): void;
};

export const handleError: HandleError = (err, fieldStates, setGlobalError, localizationConfig) => {
  // Throw unknown errors
  if (!isKnownError(err)) {
    throw err;
  }

  if (isMetamaskError(err)) {
    return handleMetamaskError(err, fieldStates, setGlobalError);
  }

  if (isClerkAPIResponseError(err)) {
    return handleClerkApiError(err, fieldStates, setGlobalError, localizationConfig);
  }
};

// Returns the first global API error or undefined if none exists.
export function getGlobalError(err: Error): ClerkAPIError | undefined {
  if (!isClerkAPIResponseError(err)) {
    return;
  }
  const { globalErrors } = parseErrors(err.errors);
  if (!globalErrors.length) {
    return;
  }
  return globalErrors[0];
}

// Returns the first field API error or undefined if none exists.
export function getFieldError(err: Error): ClerkAPIError | undefined {
  if (!isClerkAPIResponseError(err)) {
    return;
  }

  const { fieldErrors } = parseErrors(err.errors);

  if (!fieldErrors.length) {
    return;
  }

  return fieldErrors[0];
}

export function getClerkAPIErrorMessage(err: ClerkAPIError): string {
  return err.longMessage || err.message;
}

const handleMetamaskError: HandleError = (err, _, setGlobalError) => {
  return setGlobalError?.(err.message);
};

const handleClerkApiError: HandleError = (err, fieldStates, setGlobalError, localizationConfig) => {
  if (!isClerkAPIResponseError(err)) {
    return;
  }

  const { fieldErrors, globalErrors } = parseErrors(err.errors);
  setFieldErrors(fieldStates, fieldErrors, localizationConfig);

  if (setGlobalError) {
    setGlobalError(undefined);
    // Show only the first global error until we have snack bar stacks if applicable
    // TODO: Make global errors localizable
    const firstGlobalError = globalErrors[0];
    if (firstGlobalError) {
      setGlobalError(firstGlobalError);
    }
  }
};
