# Fixture sample for the R docstring checker.
# Mix of documented and undocumented top-level objects.

calc_mean <- function(x, na.rm = TRUE) {
  mean(x, na.rm = na.rm)
}

#' Compute the arithmetic mean
#'
#' @param x A numeric vector.
#' @param na.rm Remove missing values before computing?
#' @returns A length-one numeric vector.
#' @export
calc_median <- function(x, na.rm = TRUE) {
  median(x, na.rm = na.rm)
}

`loud_name<-` <- function(x, value) {
  attr(x, "loud") <- value
  x
}

`%between%` <- function(x, range) {
  x >= range[1] & x <= range[2]
}

print.myclass <- function(x, ...) {
  cat("<myclass>\n")
}

#' Show an account summary
#'
#' @param object An Account object.
setMethod("show", "Account", function(object) {
  print(object@balance)
})

setGeneric("balance", function(object) standardGeneric("balance"))

#' An R6 person
Person <- R6::R6Class("Person",
  public = list(
    initialize = function(name = NA) {
      self$name <- name
    }
  )
)

local_helper <- function() {
  inner <- function(x) x + 1
  inner(1)
}

#' Internal helper, no Rd generated
#' @noRd
internal_util <- function(x) x * 2

anonymous_result <- lapply(1:3, function(x) x * 2)
