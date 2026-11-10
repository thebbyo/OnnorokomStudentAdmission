using System.Security.Cryptography;

namespace Admission.Tests;

public static class TestData
{
    private static readonly HashSet<string> Issued = new();

    /// <summary>17 random ASCII digits, unique within the test run.</summary>
    public static string NewStudentId()
    {
        lock (Issued)
        {
            while (true)
            {
                var digits = new char[17];
                for (var i = 0; i < 17; i++) digits[i] = (char)('0' + RandomNumberGenerator.GetInt32(10));
                var id = new string(digits);
                if (Issued.Add(id)) return id;
            }
        }
    }
}
