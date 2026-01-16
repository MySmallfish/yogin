using Microsoft.AspNetCore.Hosting;

namespace Letmein.Services;

public class LocalFileStorageProvider : IFileStorageProvider
{
    private readonly string _rootPath;

    public LocalFileStorageProvider(IWebHostEnvironment env)
    {
        _rootPath = Path.Combine(env.ContentRootPath, "App_Data", "uploads");
        Directory.CreateDirectory(_rootPath);
    }

    public async Task<string> SaveAsync(Stream content, string fileName, string contentType, CancellationToken ct)
    {
        var extension = Path.GetExtension(fileName);
        var safeName = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(_rootPath, safeName);
        await using var fileStream = new FileStream(fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await content.CopyToAsync(fileStream, ct);
        return safeName;
    }

    public Task<Stream?> OpenReadAsync(string storagePath, CancellationToken ct)
    {
        var safeName = Path.GetFileName(storagePath);
        var fullPath = Path.Combine(_rootPath, safeName);
        if (!File.Exists(fullPath))
        {
            return Task.FromResult<Stream?>(null);
        }

        Stream stream = new FileStream(fullPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Task.FromResult<Stream?>(stream);
    }

    public Task DeleteAsync(string storagePath, CancellationToken ct)
    {
        var safeName = Path.GetFileName(storagePath);
        var fullPath = Path.Combine(_rootPath, safeName);
        if (File.Exists(fullPath))
        {
            File.Delete(fullPath);
        }
        return Task.CompletedTask;
    }
}
