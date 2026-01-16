namespace Letmein.Services;

public interface IFileStorageProvider
{
    Task<string> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct);
    Task<Stream?> OpenReadAsync(string storagePath, CancellationToken ct);
    Task DeleteAsync(string storagePath, CancellationToken ct);
}
