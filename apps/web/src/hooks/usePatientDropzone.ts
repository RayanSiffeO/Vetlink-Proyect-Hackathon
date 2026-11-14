import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const ACCEPTED_FILES = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/json': ['.json'],
  'text/csv': ['.csv'],
};

export function usePatientDropzone(onAccepted: (files: File[]) => void) {
  const [rejected, setRejected] = useState<string[]>([]);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setRejected([]);
      if (accepted.length > 0) onAccepted(accepted);
    },
    [onAccepted],
  );

  const onDropRejected = useCallback((files: { file: File }[]) => {
    setRejected(files.map((item) => item.file.name));
  }, []);

  const dropzone = useDropzone({
    onDrop,
    onDropRejected,
    accept: ACCEPTED_FILES,
    multiple: true,
    noClick: true,
    noKeyboard: true,
  });

  return { ...dropzone, rejected };
}
