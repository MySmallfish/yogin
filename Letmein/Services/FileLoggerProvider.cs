using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;

namespace Letmein.Services;

public sealed class FileLoggerProvider : ILoggerProvider
{
    private readonly string _logDirectory;
    private readonly LogLevel _minLevel;
    private readonly object _lock = new();

    public FileLoggerProvider(string logDirectory, LogLevel minLevel = LogLevel.Information)
    {
        _logDirectory = logDirectory;
        _minLevel = minLevel;
    }

    public ILogger CreateLogger(string categoryName)
        => new FileLogger(categoryName, _logDirectory, _minLevel, _lock);

    public void Dispose()
    {
    }

    private sealed class FileLogger : ILogger
    {
        private readonly string _categoryName;
        private readonly string _logDirectory;
        private readonly LogLevel _minLevel;
        private readonly object _lock;

        public FileLogger(string categoryName, string logDirectory, LogLevel minLevel, object logLock)
        {
            _categoryName = categoryName;
            _logDirectory = logDirectory;
            _minLevel = minLevel;
            _lock = logLock;
        }

        public IDisposable BeginScope<TState>(TState state) => NullScope.Instance;

        public bool IsEnabled(LogLevel logLevel) => logLevel >= _minLevel;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            var message = formatter(state, exception);
            if (string.IsNullOrWhiteSpace(message) && exception == null)
            {
                return;
            }

            var timestamp = DateTime.UtcNow.ToString("o");
            var line = $"[{timestamp}] [{logLevel}] {_categoryName}: {message}";
            if (exception != null)
            {
                line = $"{line}{Environment.NewLine}{exception}";
            }

            var filePath = Path.Combine(_logDirectory, $"app-{DateTime.UtcNow:yyyy-MM-dd}.log");
            lock (_lock)
            {
                Directory.CreateDirectory(_logDirectory);
                File.AppendAllText(filePath, line + Environment.NewLine);
            }
        }

        private sealed class NullScope : IDisposable
        {
            public static readonly NullScope Instance = new();
            public void Dispose() { }
        }
    }
}
