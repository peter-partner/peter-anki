import { useDropzone } from 'react-dropzone';

export default function DropZone({ onFileSelect, disabled }) {
  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop: (accepted) => accepted.length > 0 && onFileSelect(accepted[0]),
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    disabled,
  });

  const containerClass = [
    'relative border-2 border-dashed rounded-2xl p-16 cursor-pointer transition-all duration-200 select-none',
    isDragReject
      ? 'border-red-400 bg-red-50 dark:bg-red-900/10'
      : isDragActive
      ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/10'
      : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50/70 dark:hover:bg-gray-900/50',
    disabled ? 'opacity-50 pointer-events-none' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const icon = isDragReject ? '❌' : isDragActive ? '📥' : '📄';
  const title = isDragReject
    ? 'Only PDF files are accepted'
    : isDragActive
    ? 'Release to upload'
    : 'Drop your PDF here';

  return (
    <div {...getRootProps()} className={containerClass}>
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-4 pointer-events-none">
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl
            bg-gray-100 dark:bg-gray-800 transition-transform duration-200
            ${isDragActive ? 'scale-110' : ''}`}
        >
          {icon}
        </div>
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900 dark:text-white">{title}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            or{' '}
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              click to browse
            </span>{' '}
            · PDF files up to 50 MB
          </p>
        </div>
      </div>
    </div>
  );
}
