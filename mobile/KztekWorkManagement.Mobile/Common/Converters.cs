using System;
using System.Globalization;
using Avalonia.Data.Converters;
using Avalonia.Media;

namespace KztekWorkManagement.Mobile.Common
{
    public class StatusToBrushConverter : IValueConverter
    {
        public static readonly StatusToBrushConverter Instance = new();

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            var status = value?.ToString()?.ToUpper() ?? "";
            return status switch
            {
                "TODO" => new SolidColorBrush(Color.Parse("#3B82F6")), // Blue
                "IN_PROGRESS" => new SolidColorBrush(Color.Parse("#F05922")), // KZTEK Orange
                "IN_REVIEW" => new SolidColorBrush(Color.Parse("#8B5CF6")), // Purple
                "DONE" => new SolidColorBrush(Color.Parse("#10B981")), // Green
                "OPEN" => new SolidColorBrush(Color.Parse("#FFAA80")), // KZTEK Orange light (ticket mới)
                "ACKNOWLEDGED" => new SolidColorBrush(Color.Parse("#4A3F8C")), // KZTEK Navy light
                "TRIAGED" => new SolidColorBrush(Color.Parse("#F59E0B")), // Yellow
                "CLOSED" => new SolidColorBrush(Color.Parse("#10B981")), // Green (ticket đã đóng)
                "CANCELLED" => new SolidColorBrush(Color.Parse("#64748B")), // Slate (ticket đã hủy)
                _ => new SolidColorBrush(Color.Parse("#64748B")) // Slate
            };
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class PriorityToColorConverter : IValueConverter
    {
        public static readonly PriorityToColorConverter Instance = new();

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            var priority = value?.ToString()?.ToUpper() ?? "";
            return priority switch
            {
                "URGENT" => new SolidColorBrush(Color.Parse("#EF4444")),
                "HIGH" => new SolidColorBrush(Color.Parse("#F59E0B")),
                "MEDIUM" => new SolidColorBrush(Color.Parse("#3B82F6")),
                "LOW" => new SolidColorBrush(Color.Parse("#10B981")),
                _ => new SolidColorBrush(Color.Parse("#64748B"))
            };
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class BooleanToVisibilityConverter : IValueConverter
    {
        public static readonly BooleanToVisibilityConverter Instance = new();

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is bool b)
            {
                return b;
            }
            return false;
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class InvertedBooleanConverter : IValueConverter
    {
        public static readonly InvertedBooleanConverter Instance = new();

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            if (value is bool b) return !b;
            return true;
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
    }

    public class StringToInitialsConverter : IValueConverter
    {
        public static readonly StringToInitialsConverter Instance = new();

        public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
        {
            var name = value?.ToString()?.Trim() ?? "";
            if (string.IsNullOrEmpty(name)) return "K";

            var parts = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (parts.Length == 1) return parts[0].Substring(0, Math.Min(2, parts[0].Length)).ToUpper();
            return $"{parts[0][0]}{parts[^1][0]}".ToUpper();
        }

        public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture) => throw new NotImplementedException();
    }
}
