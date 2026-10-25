# seahorse_qc.R - quick QC of the Seahorse exports before the real analysis
#
#  1. CV of basal OCR per plate, line and treatment (basal = mean of measurements 1-3)
#  2. flags wells that look wrong: low basal OCR (cells lifted off?), no oligomycin
#     response, no FCCP response, basal far from the rest of its group,
#     background wells that drift
#
# TODO only runs on my laptop (Windows path below, and plyr is not on the lab PC).
#      Move this to Python next to normalise_ocr.py.

library(plyr)

data_dir <- "C:/Users/mateo/Documents/seahorse/GBA1_series"
xf <- read.csv(file.path(data_dir, "xf_exports_6plates.csv"),
               comment.char = "#", stringsAsFactors = FALSE)

# one row per well with the rates we need
wells <- ddply(xf, .(plate, day, well, group, treatment), summarise,
               basal  = mean(OCR_pmol_min[measurement %in% 1:3]),
               oligo  = min(OCR_pmol_min[measurement %in% 4:6]),
               fccp   = max(OCR_pmol_min[measurement %in% 7:9]),
               rot_aa = min(OCR_pmol_min[measurement %in% 10:12]))

cells <- subset(wells, group != "background")
bg    <- subset(wells, group == "background")

# 1. CV of basal OCR (raw, per well - before nuclei normalisation)
cv <- ddply(cells, .(plate, day, group, treatment), summarise,
            n_wells    = length(basal),
            mean_basal = round(mean(basal), 1),
            sd_basal   = round(sd(basal), 1),
            cv_pct     = round(100 * sd(basal) / mean(basal), 1))
print(cv)

# 2. flags
add_flag <- function(flag, cond, text) {
  ifelse(cond, ifelse(flag == "", text, paste(flag, text, sep = "; ")), flag)
}

cells <- ddply(cells, .(plate, group, treatment), transform,
               z = (basal - mean(basal)) / sd(basal))
cells$flag <- ""
cells$flag <- add_flag(cells$flag, cells$basal < 15, "low basal OCR")
cells$flag <- add_flag(cells$flag, cells$oligo > 0.9 * cells$basal, "no oligomycin response")
cells$flag <- add_flag(cells$flag, cells$fccp < cells$basal, "no FCCP response")
cells$flag <- add_flag(cells$flag, abs(cells$z) > 3, "basal > 3 SD from group")

bg$flag <- ifelse(abs(bg$basal) > 5, "background drift", "")

keep  <- c("plate", "day", "well", "group", "treatment", "basal", "flag")
flags <- rbind(cells[cells$flag != "", keep], bg[bg$flag != "", keep])

write.csv(cv, file.path(data_dir, "qc_cv_basal.csv"), row.names = FALSE)
write.csv(flags, file.path(data_dir, "qc_flags.csv"), row.names = FALSE)
cat(nrow(flags), "wells flagged, see qc_flags.csv\n")
