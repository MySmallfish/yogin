using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace Letmein.Services;

public interface IEmailService
{
    bool IsConfigured { get; }
    Task SendAsync(string toEmail, string subject, string body, CancellationToken ct);
}

public class EmailSettings
{
    public string FromEmail { get; set; } = "";
    public string FromName { get; set; } = "Yogin";
    public SmtpSettings Smtp { get; set; } = new();
}

public class SmtpSettings
{
    public string Host { get; set; } = "";
    public int Port { get; set; } = 587;
    public string User { get; set; } = "";
    public string Password { get; set; } = "";
    public bool EnableSsl { get; set; } = true;
}

public class SmtpEmailService : IEmailService
{
    private readonly EmailSettings _settings;

    public SmtpEmailService(IOptions<EmailSettings> options)
    {
        _settings = options.Value;
    }

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_settings.FromEmail) &&
        !string.IsNullOrWhiteSpace(_settings.Smtp?.Host);

    public async Task SendAsync(string toEmail, string subject, string body, CancellationToken ct)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException("Email delivery is not configured.");
        }

        using var message = new MailMessage
        {
            From = new MailAddress(_settings.FromEmail, _settings.FromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(_settings.Smtp.Host, _settings.Smtp.Port)
        {
            EnableSsl = _settings.Smtp.EnableSsl
        };

        if (!string.IsNullOrWhiteSpace(_settings.Smtp.User))
        {
            client.Credentials = new NetworkCredential(_settings.Smtp.User, _settings.Smtp.Password);
        }

        await client.SendMailAsync(message);
    }
}
