using Admission.Api.Domain;

namespace Admission.Tests;

public class PublicIdTests
{
    private static readonly Guid G = Guid.Parse("3f2a1b4c-5d6e-7f80-91a2-b3c4d5e6f708");

    [Fact]
    public void Class_FormatsWithPrefixAndNFormat() =>
        Assert.Equal("c_" + G.ToString("N"), PublicId.Class(G));

    [Fact]
    public void Hold_FormatsWithPrefixAndNFormat() =>
        Assert.Equal("h_" + G.ToString("N"), PublicId.Hold(G));

    [Fact]
    public void TryParseClass_RoundTrips()
    {
        Assert.True(PublicId.TryParseClass(PublicId.Class(G), out var parsed));
        Assert.Equal(G, parsed);
    }

    [Fact]
    public void TryParseHold_RoundTrips()
    {
        Assert.True(PublicId.TryParseHold(PublicId.Hold(G), out var parsed));
        Assert.Equal(G, parsed);
    }

    public static TheoryData<string?> BadClassIds => new()
    {
        null, "", "c_", "c_xyz", "h_" + G.ToString("N"), "c_" + G.ToString("D"),
        "C_" + G.ToString("N"), "c_" + G.ToString("N") + "0", " c_" + G.ToString("N"), "not-a-guid",
    };

    public static TheoryData<string?> BadHoldIds => new()
    {
        null, "", "h_", "h_xyz", "c_" + G.ToString("N"), "h_" + G.ToString("D"),
        "H_" + G.ToString("N"), "h_" + G.ToString("N") + "0", "not-a-guid",
    };

    [Theory]
    [InlineData("N")]
    [InlineData("D")]
    public void BareGuids_AreWellFormed_SoUnknownOnesAre404Not400(string format)
    {
        Assert.True(PublicId.TryParseClass(G.ToString(format), out var c));
        Assert.True(PublicId.TryParseHold(G.ToString(format), out var h));
        Assert.Equal(G, c);
        Assert.Equal(G, h);
    }

    [Theory, MemberData(nameof(BadClassIds))]
    public void TryParseClass_RejectsMalformed(string? input) =>
        Assert.False(PublicId.TryParseClass(input, out _));

    [Theory, MemberData(nameof(BadHoldIds))]
    public void TryParseHold_RejectsMalformed(string? input) =>
        Assert.False(PublicId.TryParseHold(input, out _));
}
