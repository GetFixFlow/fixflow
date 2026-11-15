module Ai
  # Which of a company's assets a few plain words may be about ("pump on line 3 is leaking oil"): the handful whose name, tag or
  # place contains the most of the words. It runs in the database; nothing is sent anywhere. The draft work order is shown only
  # these, so it can only ever choose one of them, and a company with thousands of assets does not send the model all of them.
  #
  # Two things keep the handful about the problem and not about the words around it:
  # - a short word (one or two characters, such as the 3 of "line 3") only counts for an asset that something longer has already
  #   matched, so "3" does not bring in "Fan 3" and "Fan 30";
  # - an asset found only by its place (every asset on "Line 3" has "line") is left out when any asset is found by its name or
  #   tag, and is offered only when nothing is ("something on line 3 is noisy").
  class AssetMatcher
    LIMIT  = 10
    SCAN   = 300  # the most rows looked at before they are scored
    WORDS  = 12
    # Words that say nothing about which asset it is, in English and Spanish.
    COMMON = %w[the and is are was were has have had not with from for that this its into out off over under near on in at of to it a an
                my
                our there then than but too very just still keeps keep need needs needed please check fix broken problem issue
                el la los las un una unos unas es son esta esta está estan están tiene tienen del de al en con por para que se no muy
                y o pero mi nuestro nuestra falla problema revisar].freeze

    Match = Struct.new(:asset, :path, :score, :named, keyword_init: true)

    # => the matches, best first.
    def self.for(organization, text) = new(organization, text).matches

    def initialize(organization, text)
      @organization = organization
      @words = text.to_s.downcase.scan(/[[:alnum:]][-[:alnum:]]*/).reject { |word| COMMON.include?(word) }.uniq.first(WORDS)
      @strong = @words.select { |word| word.length > 2 }
      @weak = @words - @strong
    end

    def matches
      return [] if @strong.empty?

      scored = candidates.map { |asset| tally(asset, asset.location&.full_path.to_s) }
      named = scored.select(&:named)
      (named.presence || scored).sort_by { |match| [-match.score, match.asset.name.downcase] }.first(LIMIT)
    end

    private

    # Assets with at least one of the words at the start of a word in the name, the tag, or the place.
    def candidates
      Asset.kept.where(organization_id: @organization.id).left_joins(:location).includes(:location)
           .where(@strong.map { "(assets.name ~* ? OR assets.asset_tag ~* ? OR locations.name ~* ?)" }.join(" OR "), *patterns)
           .limit(SCAN)
    end

    def patterns
      @strong.flat_map { |word| [regex(word)] * 3 }
    end

    def regex(word) = "\\y#{Regexp.escape(word)}"

    # How many of the words each asset has: a word in the name counts most, the tag next, the place least. Every asset here has a
    # longer word already (the query asks for one), so the short ones may count.
    def tally(asset, path)
      Match.new(asset: asset, path: path, score: points(@strong, asset, path) + points(@weak, asset, path),
                named: points(@strong, asset, nil).positive?)
    end

    def points(words, asset, path)
      words.sum do |word|
        pattern = Regexp.new("\\b#{Regexp.escape(word)}", Regexp::IGNORECASE)
        (asset.name.to_s.match?(pattern) ? 3 : 0) + (asset.asset_tag.to_s.match?(pattern) ? 4 : 0) + (path&.match?(pattern) ? 1 : 0)
      end
    end
  end
end
