// Leap year in Zig

const std = @import("std");

var out: *std.Io.Writer = undefined;

fn isLeapYear(year: i64) bool {
    return (@rem(year, 4) == 0 and @rem(year, 100) != 0) or @rem(year, 400) == 0;
}

pub fn main(init: std.process.Init) void {
    var buffer: [4096]u8 = undefined;
    var writer = std.Io.File.stdout().writer(init.io, &buffer);
    out = &writer.interface;
    defer out.flush() catch {};

    var year: i64 = 1896;
    while (year <= 1912) : (year += 1) {
        if (isLeapYear(year)) {
            out.print("{d} is a leap year\n", .{year}) catch {};
        } else {
            out.print("{d} is not a leap year\n", .{year}) catch {};
        }
    }
}
